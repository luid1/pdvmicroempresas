import { Injectable, NotFoundException } from '@nestjs/common';
import { ModoOperacao } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dados da empresa (tenant) — hoje foca no MODO de operação (multissegmento),
 * definido server-side e compartilhado por todos os usuários da empresa.
 */
@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}

  async getEmpresa(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, modo: true },
    });
    if (!t) throw new NotFoundException('Empresa não encontrada.');
    return t;
  }

  async definirModo(tenantId: string, modo: ModoOperacao) {
    const t = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { modo },
      select: { id: true, modo: true },
    });
    return { ok: true, modo: t.modo };
  }
}
