import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** CRT (Código de Regime Tributário) coerente com o regime da filial emitente. */
function crtDeRegime(regime?: string | null): string | null {
  if (!regime) return null;
  const v = String(regime).toUpperCase();
  if (v.includes('MEI')) return '4';       // Simples Nacional - MEI
  if (v.includes('PRESUMIDO') || v.includes('REAL')) return '3'; // Regime Normal
  return '1';                               // Simples Nacional
}

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
    // Mantém o CRT coerente com o regime; um CRT explícito no dto prevalece.
    if (out.regimeTributario && (out.crt === undefined || out.crt === '' || out.crt === null)) {
      const crt = crtDeRegime(out.regimeTributario);
      if (crt) out.crt = crt;
    }
    return out;
  }

  async updateRegime(tenantId: string, id: string, dto: { regimeTributario?: string; crt?: string; cnpj?: string; ie?: string }) {
    const filial = await this.prisma.filial.findFirst({ where: { id, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');
    const crt = dto.crt || crtDeRegime(dto.regimeTributario);
    return this.prisma.filial.update({
      where: { id },
      data: {
        ...(dto.regimeTributario && { regimeTributario: dto.regimeTributario }),
        ...(crt && { crt }),
        ...(dto.cnpj !== undefined && { cnpj: dto.cnpj }),
        ...(dto.ie !== undefined && { ie: dto.ie }),
      },
    });
  }
}
