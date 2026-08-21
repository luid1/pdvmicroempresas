import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { FiliaisService } from '../filiais/filiais.service';
import { AtualizarLojaDto, CriarLojaDto } from './dto/plataforma.dto';

/**
 * Painel do DONO DA PLATAFORMA (SaaS). Opera CROSS-TENANT — só é alcançável
 * atrás do SuperAdminGuard. Reaproveita a criação de tenant do AuthService e o
 * CRUD de filiais do FiliaisService (passando o tenant alvo explicitamente).
 */
@Injectable()
export class PlataformaService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private filiais: FiliaisService,
  ) {}

  /** Lista todas as lojas (tenants) com contadores e status de assinatura. */
  async listarLojas(filtros: { q?: string; status?: string }) {
    const q = filtros.q?.trim();
    const where: any = {};
    if (q) {
      where.OR = [
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { nomeFantasia: { contains: q, mode: 'insensitive' } },
        { cnpj: { contains: q.replace(/\D/g, '') || q } },
      ];
    }
    if (filtros.status === 'ativas') where.ativo = true;
    if (filtros.status === 'inativas') where.ativo = false;

    const lojas = await this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
        plano: true, ativo: true, regimeTributario: true, createdAt: true,
        _count: { select: { filiais: true, users: true } },
        assinatura: {
          select: {
            status: true, trialAte: true, proximaCobranca: true,
            plano: { select: { nome: true, codigo: true } },
          },
        },
      },
    });
    return lojas.map((l) => ({
      ...l,
      filiaisCount: l._count.filiais,
      usuariosCount: l._count.users,
      _count: undefined,
    }));
  }

  /** Detalhe de uma loja: dados, filiais, usuários e assinatura. */
  async obterLoja(id: string) {
    const loja = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, ie: true,
        im: true, emailNfe: true, plano: true, ativo: true, regimeTributario: true,
        crt: true, createdAt: true,
        assinatura: {
          select: {
            status: true, periodo: true, trialAte: true, proximaCobranca: true,
            plano: { select: { nome: true, codigo: true, precoMensal: true } },
          },
        },
        filiais: {
          orderBy: { codigo: 'asc' },
          select: {
            id: true, codigo: true, nome: true, tipo: true, cnpj: true, ie: true,
            regimeTributario: true, crt: true, ativo: true, endereco: true, createdAt: true,
          },
        },
        users: {
          orderBy: { nome: 'asc' },
          select: {
            id: true, nome: true, email: true, ativo: true, isSuperAdmin: true,
            ultimoAcesso: true, role: { select: { nome: true } },
          },
        },
      },
    });
    if (!loja) throw new NotFoundException('Loja não encontrada.');
    return loja;
  }

  /** Cria uma loja nova (tenant + matriz + admin master). */
  async criarLoja(dto: CriarLojaDto) {
    const criado = await this.auth.registerTenant({
      razaoSocial: dto.razaoSocial,
      cnpj: dto.cnpj,
      regimeTributario: dto.regimeTributario,
      adminNome: dto.adminNome,
      adminEmail: dto.adminEmail,
      password: dto.password,
      filialNome: dto.filialNome?.trim() || dto.nomeFantasia?.trim() || dto.razaoSocial,
      filialCodigo: dto.filialCodigo?.trim() || '0001',
    });

    // Nome fantasia não é criado pelo registerTenant — aplica se veio no formulário.
    if (dto.nomeFantasia?.trim()) {
      await this.prisma.tenant.update({
        where: { id: criado.tenant.id },
        data: { nomeFantasia: dto.nomeFantasia.trim() },
      });
    }
    return this.obterLoja(criado.tenant.id);
  }

  /** Atualiza cadastro da loja; `ativo:false` = desativar (soft-delete). */
  async atualizarLoja(id: string, dto: AtualizarLojaDto) {
    const loja = await this.prisma.tenant.findUnique({ where: { id } });
    if (!loja) throw new NotFoundException('Loja não encontrada.');
    await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.razaoSocial !== undefined && { razaoSocial: dto.razaoSocial }),
        ...(dto.nomeFantasia !== undefined && { nomeFantasia: dto.nomeFantasia || null }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
        ...(dto.plano !== undefined && { plano: dto.plano }),
        ...(dto.regimeTributario !== undefined && { regimeTributario: dto.regimeTributario }),
        ...(dto.ie !== undefined && { ie: dto.ie || null }),
        ...(dto.emailNfe !== undefined && { emailNfe: dto.emailNfe || null }),
      },
    });
    return this.obterLoja(id);
  }

  /** Cadastra uma filial na loja alvo. */
  async adicionarFilial(tenantId: string, dto: any) {
    const loja = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!loja) throw new NotFoundException('Loja não encontrada.');
    return this.filiais.create(tenantId, dto);
  }

  /** Atualiza uma filial de qualquer loja (resolve o tenant pela própria filial). */
  async atualizarFilial(filialId: string, dto: any) {
    const filial = await this.prisma.filial.findUnique({ where: { id: filialId }, select: { tenantId: true } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');
    return this.filiais.update(filial.tenantId, filialId, dto);
  }

  /** Ativa/desativa uma filial (soft-delete). */
  async toggleFilial(filialId: string, ativo: boolean) {
    const filial = await this.prisma.filial.findUnique({ where: { id: filialId }, select: { id: true } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');
    if (typeof ativo !== 'boolean') throw new BadRequestException('Informe o novo estado (ativo).');
    return this.prisma.filial.update({ where: { id: filialId }, data: { ativo } });
  }
}
