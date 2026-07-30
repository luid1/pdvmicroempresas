import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditoriaService {
  constructor(private prisma: PrismaService) {}

  /** Últimos eventos de auditoria do tenant (mais recentes primeiro). */
  async findAll(tenantId: string, limite = 300) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 1000),
      include: { usuario: { select: { nome: true, email: true } } },
    });

    return logs.map((l) => ({
      id: l.id,
      modulo: l.modulo,
      acao: l.acao,
      entidade: l.entidade,
      entidadeId: l.entidadeId,
      usuario: l.usuario?.nome || 'Sistema',
      usuarioEmail: l.usuario?.email || null,
      ip: l.ip,
      dadosAntes: l.dadosAntes,
      dadosDepois: l.dadosDepois,
      createdAt: l.createdAt,
    }));
  }
}
