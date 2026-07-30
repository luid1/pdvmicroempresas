import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  // ─────────── USUÁRIOS ───────────
  async listUsuarios(tenantId: string) {
    return this.prisma.usuario.findMany({
      where: { tenantId },
      select: {
        id: true, nome: true, email: true, cpf: true, ativo: true, ultimoAcesso: true, createdAt: true,
        role: { select: { id: true, nome: true } },
        filiais: { select: { filial: { select: { id: true, codigo: true, nome: true } } } },
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async createUsuario(tenantId: string, dto: {
    nome: string; email: string; senha: string; roleId: string; cpf?: string; ativo?: boolean; filialIds?: string[];
  }) {
    if (!dto.nome || !dto.email || !dto.senha || !dto.roleId) throw new BadRequestException('Nome, e-mail, senha e perfil são obrigatórios.');
    const existe = await this.prisma.usuario.findFirst({ where: { tenantId, email: dto.email } });
    if (existe) throw new ConflictException('Já existe um usuário com este e-mail.');
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
    if (!role) throw new NotFoundException('Perfil não encontrado.');

    const hash = await bcrypt.hash(dto.senha, 12);
    const usuario = await this.prisma.usuario.create({
      data: {
        tenantId, roleId: dto.roleId, nome: dto.nome, email: dto.email, passwordHash: hash,
        cpf: dto.cpf || null, ativo: dto.ativo ?? true,
        filiais: dto.filialIds?.length ? { create: dto.filialIds.map((id) => ({ filialId: id })) } : undefined,
      },
    });
    return { id: usuario.id };
  }

  async updateUsuario(tenantId: string, id: string, dto: {
    nome?: string; email?: string; roleId?: string; cpf?: string; ativo?: boolean; filialIds?: string[];
  }) {
    const u = await this.prisma.usuario.findFirst({ where: { id, tenantId } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    if (dto.email && dto.email !== u.email) {
      const dup = await this.prisma.usuario.findFirst({ where: { tenantId, email: dto.email, NOT: { id } } });
      if (dup) throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome, email: dto.email, roleId: dto.roleId, cpf: dto.cpf, ativo: dto.ativo,
      },
    });
    if (dto.filialIds) {
      await this.prisma.usuarioFilial.deleteMany({ where: { usuarioId: id } });
      if (dto.filialIds.length) {
        await this.prisma.usuarioFilial.createMany({ data: dto.filialIds.map((fid) => ({ usuarioId: id, filialId: fid })) });
      }
    }
    return { ok: true };
  }

  async resetSenha(tenantId: string, id: string, senha: string) {
    const u = await this.prisma.usuario.findFirst({ where: { id, tenantId } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    if (!senha || senha.length < 4) throw new BadRequestException('Senha muito curta.');
    await this.prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(senha, 12) } });
    return { ok: true };
  }

  async deleteUsuario(tenantId: string, id: string) {
    const u = await this.prisma.usuario.findFirst({ where: { id, tenantId } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    // Não apaga: inativa (preserva histórico/auditoria)
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }

  // ─────────── PERFIS (ROLES) ───────────
  async listRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, nome: true, descricao: true, telas: true, telaInicial: true, acoes: true, _count: { select: { usuarios: true } } },
      orderBy: { nome: 'asc' },
    });
    return roles;
  }

  async createRole(tenantId: string, dto: { nome: string; descricao?: string; telas?: string[]; telaInicial?: string; acoes?: any }) {
    if (!dto.nome) throw new BadRequestException('Nome do perfil é obrigatório.');
    const existe = await this.prisma.role.findFirst({ where: { tenantId, nome: dto.nome } });
    if (existe) throw new ConflictException('Já existe um perfil com este nome.');
    const role = await this.prisma.role.create({
      data: { tenantId, nome: dto.nome, descricao: dto.descricao || null, telas: dto.telas || [], telaInicial: dto.telaInicial || null, acoes: dto.acoes ?? undefined },
    });
    return { id: role.id };
  }

  async updateRole(tenantId: string, id: string, dto: { nome?: string; descricao?: string; telas?: string[]; telaInicial?: string; acoes?: any }) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Perfil não encontrado.');
    if (dto.nome && dto.nome !== role.nome) {
      const dup = await this.prisma.role.findFirst({ where: { tenantId, nome: dto.nome, NOT: { id } } });
      if (dup) throw new ConflictException('Já existe um perfil com este nome.');
    }
    await this.prisma.role.update({
      where: { id },
      data: { nome: dto.nome, descricao: dto.descricao, telas: dto.telas, telaInicial: dto.telaInicial, acoes: dto.acoes ?? undefined },
    });
    return { ok: true };
  }

  async deleteRole(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId }, include: { _count: { select: { usuarios: true } } } });
    if (!role) throw new NotFoundException('Perfil não encontrado.');
    if (role.nome === 'ADMIN') throw new BadRequestException('O perfil ADMIN não pode ser removido.');
    if (role._count.usuarios > 0) throw new BadRequestException('Há usuários usando este perfil. Mude-os de perfil antes de remover.');
    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }
}
