import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { validarCnpj } from '../../common/utils/fiscal-validators.util';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  /**
   * Retorna a lista de usuários ativos do tenant para a tela de seleção.
   * Público — não expõe senha ou dados sensíveis.
   */
  async getUsersForLogin(pairToken?: string, tenantId?: string) {
    if (!pairToken) throw new UnauthorizedException('Este computador não está vinculado a uma empresa.');

    let payload: { tenantId?: string; purpose?: string };
    try {
      payload = this.jwt.verify(pairToken);
    } catch {
      throw new UnauthorizedException('Vínculo expirado ou inválido. Vincule este computador novamente.');
    }
    if (payload.purpose !== 'pair' || !payload.tenantId) {
      throw new UnauthorizedException('Token de vínculo inválido.');
    }
    if (tenantId && tenantId !== payload.tenantId) {
      throw new UnauthorizedException('O vínculo não pertence a esta empresa.');
    }
    const resolvedTenantId = payload.tenantId;

    const usuarios = await this.prisma.usuario.findMany({
      where: { tenantId: resolvedTenantId, ativo: true },
      select: {
        id: true,
        nome: true,
        pinHash: true,
        role: { select: { nome: true } },
        ultimoAcesso: true,
      },
      orderBy: [
        { role: { nome: 'asc' } },
        { nome: 'asc' },
      ],
    });

    // Nunca expõe o hash — só informa se o perfil já tem PIN configurado.
    return usuarios.map(({ pinHash, ...u }) => ({ ...u, temPin: !!pinHash }));
  }

  /** Token restrito usado somente para listar os perfis no computador vinculado. */
  private criarPairToken(tenantId: string): string {
    return this.jwt.sign({ tenantId, purpose: 'pair' }, { expiresIn: '30d' });
  }

  async registerTenant(dto: {
    razaoSocial: string; cnpj: string; regimeTributario?: string;
    adminNome: string; adminEmail: string; password: string;
    filialNome: string; filialCodigo: string;
  }) {
    const cnpj = dto.cnpj.replace(/\D/g, '');
    if (!validarCnpj(cnpj)) throw new BadRequestException('CNPJ inválido.');

    const exists = await this.prisma.tenant.findFirst({
      where: { OR: [{ cnpj: dto.cnpj }, { cnpj }] },
    });
    if (exists) throw new ConflictException('CNPJ já cadastrado.');

    const hash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          razaoSocial: dto.razaoSocial,
          cnpj,
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
          email: dto.adminEmail.trim().toLowerCase(),
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
      pairToken: this.criarPairToken(result.tenant.id),
      usuario: { id: result.usuario.id, nome: result.usuario.nome, email: result.usuario.email },
      tenant: { id: result.tenant.id, razaoSocial: result.tenant.razaoSocial },
      filial: { id: result.filial.id, codigo: result.filial.codigo, nome: result.filial.nome },
    };
  }

  /** Busca o usuário completo (tenant + filiais + role) para montar a sessão. */
  private async buscarUsuarioCompleto(where: { email?: string; id?: string; tenantId?: string }) {
    const { email, ...filtros } = where;
    return this.prisma.usuario.findFirst({
      where: {
        ...filtros,
        ...(email ? { email: { equals: email, mode: 'insensitive' as const } } : {}),
        ativo: true,
      },
      include: {
        tenant: true,
        filiais: { include: { filial: true } },
        role: true,
      },
    });
  }

  /** Monta o payload de sessão (token + usuário + tenant) e grava o último acesso. */
  private async montarSessao(usuario: any) {
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
      pairToken: this.criarPairToken(usuario.tenant.id),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role.nome,
        telas: usuario.role.telas || [],
        telaInicial: usuario.role.telaInicial || null,
        acoes: usuario.role.acoes || {},
        preferencias: usuario.preferencias || {},
        filiais: usuario.filiais.map((uf: any) => ({
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

  async login(email: string, password: string, cnpj?: string) {
    const emailNormalizado = email.trim().toLowerCase();
    let usuario: Awaited<ReturnType<AuthService['buscarUsuarioCompleto']>>;

    if (cnpj?.trim()) {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const tenant = await this.prisma.tenant.findFirst({
        where: { OR: [{ cnpj }, { cnpj: cnpjLimpo }], ativo: true },
        select: { id: true },
      });
      usuario = tenant
        ? await this.buscarUsuarioCompleto({ email: emailNormalizado, tenantId: tenant.id })
        : null;
    } else {
      const candidatos = await this.prisma.usuario.findMany({
        where: {
          email: { equals: emailNormalizado, mode: 'insensitive' },
          ativo: true,
          tenant: { ativo: true },
        },
        select: { id: true },
        take: 2,
      });
      if (candidatos.length > 1) {
        throw new UnauthorizedException(
          'Este e-mail pertence a mais de uma empresa. Informe o CNPJ para continuar.',
        );
      }
      usuario = candidatos.length === 1
        ? await this.buscarUsuarioCompleto({ id: candidatos[0].id })
        : null;
    }

    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    return this.montarSessao(usuario);
  }

  /** Login por userId direto (usado após seleção visual do usuário) */
  async loginPorId(usuarioId: string, password: string) {
    const usuario = await this.buscarUsuarioCompleto({ id: usuarioId });
    if (!usuario) throw new UnauthorizedException('Usuário não encontrado.');
    if (!(await bcrypt.compare(password, usuario.passwordHash))) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    return this.montarSessao(usuario);
  }

  /** Login rápido por PIN de 4 dígitos (após seleção visual do usuário). */
  async loginPorPin(usuarioId: string, pin: string) {
    if (!/^\d{4}$/.test(pin || '')) {
      throw new UnauthorizedException('O PIN deve ter 4 dígitos.');
    }
    const usuario = await this.buscarUsuarioCompleto({ id: usuarioId });
    if (!usuario) throw new UnauthorizedException('Usuário não encontrado.');
    if (!usuario.pinHash) {
      throw new UnauthorizedException('Este perfil ainda não tem PIN. Entre com a senha.');
    }
    if (!(await bcrypt.compare(pin, usuario.pinHash))) {
      throw new UnauthorizedException('PIN incorreto.');
    }
    return this.montarSessao(usuario);
  }

  /**
   * Define/troca o PIN de um usuário. Só permite dentro do mesmo tenant de quem
   * está autenticado (admin define pra si ou para a equipe da própria loja).
   */
  async definirPin(tenantId: string, alvoUsuarioId: string, pin: string) {
    if (!/^\d{4}$/.test(pin || '')) {
      throw new UnauthorizedException('O PIN deve ter 4 dígitos.');
    }
    const alvo = await this.prisma.usuario.findFirst({
      where: { id: alvoUsuarioId, tenantId, ativo: true },
    });
    if (!alvo) throw new UnauthorizedException('Usuário não encontrado nesta empresa.');

    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.usuario.update({ where: { id: alvo.id }, data: { pinHash } });
    return { ok: true };
  }

  /**
   * Salva/mescla as preferências de UI do próprio usuário autenticado.
   * Faz merge raso com as preferências existentes para não perder chaves
   * de outras telas ao salvar apenas uma preferência.
   */
  async salvarPreferencias(usuarioId: string, patch: Record<string, any>) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { preferencias: true },
    });
    if (!usuario) throw new UnauthorizedException('Usuário não encontrado.');

    const atuais = (usuario.preferencias as Record<string, any> | null) || {};
    const preferencias = { ...atuais, ...(patch || {}) };
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { preferencias },
    });
    return { ok: true, preferencias };
  }
}
