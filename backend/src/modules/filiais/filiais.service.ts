import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FiliaisService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.filial.findMany({
      where: { tenantId },
      orderBy: { codigo: 'asc' },
    });
  }

  async create(tenantId: string, dto: any) {
    const codigo = dto.codigo || `BOX${Date.now().toString().slice(-4)}`;
    return this.prisma.filial.create({ data: { tenantId, ...this.sanitize(dto), codigo } });
  }

  async update(tenantId: string, id: string, dto: any) {
    const filial = await this.prisma.filial.findFirst({ where: { id, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');
    return this.prisma.filial.update({ where: { id }, data: this.sanitize(dto) });
  }

  private sanitize(dto: any) {
    const out: any = { ...dto };
    delete out.id; delete out.tenantId; delete out.createdAt;
    if (out.capacidadePaletes !== undefined && out.capacidadePaletes !== '' && out.capacidadePaletes !== null) out.capacidadePaletes = Number(out.capacidadePaletes);
    else delete out.capacidadePaletes;
    if (out.ocupacaoPaletes !== undefined && out.ocupacaoPaletes !== '' && out.ocupacaoPaletes !== null) out.ocupacaoPaletes = Number(out.ocupacaoPaletes);
    else delete out.ocupacaoPaletes;
    if (out.endereco === undefined) out.endereco = {};
    return out;
  }

  async updateRegime(tenantId: string, id: string, dto: { regimeTributario?: string; crt?: string; cnpj?: string; ie?: string }) {
    const filial = await this.prisma.filial.findFirst({ where: { id, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');
    return this.prisma.filial.update({
      where: { id },
      data: {
        ...(dto.regimeTributario && { regimeTributario: dto.regimeTributario }),
        ...(dto.crt && { crt: dto.crt }),
        ...(dto.cnpj !== undefined && { cnpj: dto.cnpj }),
        ...(dto.ie !== undefined && { ie: dto.ie }),
      },
    });
  }
}
