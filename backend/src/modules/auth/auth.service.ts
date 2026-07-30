import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  /**
   * Retorna a lista de usuários ativos do tenant para a tela de seleção.
   * Público — não expõe senha ou dados sensíveis.
   */
  async getUsersForLogin(tenantId?: string, cnpj?: string) {
    let resolvedTenantId = tenantId;

    if (!resolvedTenantId && cnpj) {
      const tenant = await this.prisma.tenant.findUnique({ where: { cnpj } });
      if (!tenant) return [];
      resolvedTenantId = tenant.id;
    }

    if (!resolvedTenantId) {
      // Fallback: pega o único tenant ativo (uso interno / single-tenant)
      const tenant = await this.prisma.tenant.findFirst({ where: { ativo: true } });
      if (!tenant) return [];
      resolvedTenantId = tenant.id;
    }

    return this.prisma.usuario.findMany({
      where: { tenantId: resolvedTenantId, ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        role: { select: { nome: true } },
        ultimoAcesso: true,
      },
      orderBy: [
        { role: { nome: 'asc' } },
        { nome: 'asc' },
      ],
    });
  }

  async registerTenant(dto: {
    razaoSocial: string; cnpj: string; regimeTributario?: string;
    adminNome: string; adminEmail: string; password: string;
    filialNome: string; filialCodigo: string;
  }) {
    const exists = await this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj } });
    if (exists) throw new ConflictException('CNPJ já cadastrado.');

    const hash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          razaoSocial: dto.razaoSocial,
          cnpj: dto.cnpj,
          regimeTributario: dto.regimeTributario || 'SIMPLES_NACIONAL',
        },
      });

      const permissoes = await tx.permissao.findMany();
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          nome: 'ADMIN',
          descricao: 'Administrador master',
          permissoes: { create: permissoes.map((p) => ({ permissaoId: p.id })) },
        },
      });

      const filial = await tx.filial.create({
        data: {
          tenantId: tenant.id,
          codigo: dto.filialCodigo,
          nome: dto.filialNome,
          tipo: 'MATRIZ',
          endereco: {},
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          roleId: role.id,
          nome: dto.adminNome,
          email: dto.adminEmail,
          passwordHash: hash,
          filiais: { create: { filialId: filial.id } },
        },
      });

      return { tenant, usuario, filial };
    });

    const token = this.jwt.sign({
      sub: result.usuario.id,
      tenantId: result.tenant.id,
      roleId: result.usuario.roleId,
    });

    return {
      token,
      usuario: { id: result.usuario.id, nome: result.usuario.nome, email: result.usuario.email },
      tenant: { id: result.tenant.id, razaoSocial: result.tenant.razaoSocial },
      filial: { id: result.filial.id, codigo: result.filial.codigo, nome: result.filial.nome },
    };
  }

  async login(email: string, password: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email, ativo: true },
      include: {
        tenant: true,
        filiais: { include: { filial: true } },
        role: true,
      },
    });

    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    if (!usuario.tenant.ativo) throw new UnauthorizedException('Empresa inativa.');

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcesso: new Date() },
    });

    const token = this.jwt.sign({
      sub: usuario.id,
      tenantId: usuario.tenantId,
      roleId: usuario.roleId,
    });

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role.nome,
        telas: usuario.role.telas || [],
        telaInicial: usuario.role.telaInicial || null,
        acoes: usuario.role.acoes || {},
        filiais: usuario.filiais.map((uf) => ({
          id: uf.filial.id,
          codigo: uf.filial.codigo,
          nome: uf.filial.nome,
        })),
      },
      tenant: {
        id: usuario.tenant.id,
        razaoSocial: usuario.tenant.razaoSocial,
        nomeFantasia: usuario.tenant.nomeFantasia,
      },
    };
  }

  /** Login por userId direto (usado após seleção visual do usuário) */
  async loginPorId(usuarioId: string, password: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, ativo: true },
      include: {
        tenant: true,
        filiais: { include: { filial: true } },
        role: true,
      },
    });

    if (!usuario) throw new UnauthorizedException('Usuário não encontrado.');
    if (!(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    if (!usuario.tenant.ativo) throw new UnauthorizedException('Empresa inativa.');

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcesso: new Date() },
    });

    const token = this.jwt.sign({
      sub: usuario.id,
      tenantId: usuario.tenantId,
      roleId: usuario.roleId,
    });

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role.nome,
        telas: usuario.role.telas || [],
        telaInicial: usuario.role.telaInicial || null,
        acoes: usuario.role.acoes || {},
        filiais: usuario.filiais.map((uf) => ({
          id: uf.filial.id,
          codigo: uf.filial.codigo,
          nome: uf.filial.nome,
        })),
      },
      tenant: {
        id: usuario.tenant.id,
        razaoSocial: usuario.tenant.razaoSocial,
        nomeFantasia: usuario.tenant.nomeFantasia,
      },
    };
  }
}
