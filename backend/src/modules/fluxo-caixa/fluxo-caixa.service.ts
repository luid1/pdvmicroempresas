import { Injectable } from '@nestjs/common';
import { StatusFinanceiro } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, sumMoney, subMoney } from '../../common/utils/money.util';

/** Filtros do consolidado de fluxo de caixa. */
export interface FluxoCaixaDto {
  filialId?: string;
  dataIni?: string; // competência: dataPagamento >= dataIni
  dataFim?: string; // competência: dataPagamento <= dataFim
  agrupamento?: 'dia' | 'mes';
}

export interface Periodo {
  periodo: string; // 'YYYY-MM-DD' (dia) ou 'YYYY-MM' (mês)
  entradas: number;
  saidas: number;
  saldoPeriodo: number; // entradas - saidas
  saldoAcumulado: number; // running total
}

@Injectable()
export class FluxoCaixaService {
  constructor(private prisma: PrismaService) {}

  /**
   * Visão de Caixa REALIZADO: considera apenas o que efetivamente entrou/saiu do
   * caixa — títulos com status PAGO ou PARCIAL, pela data de pagamento. Agrupa por
   * competência (dia ou mês) e calcula o saldo líquido corrente (saldo acumulado).
   */
  async consolidado(tenantId: string, filtros: FluxoCaixaDto = {}) {
    const agrupamento = filtros.agrupamento === 'dia' ? 'dia' : 'mes';
    const inicio = filtros.dataIni ? this.inicioDoDia(new Date(filtros.dataIni)) : undefined;
    const fim = filtros.dataFim ? this.fimDoDia(new Date(filtros.dataFim)) : undefined;

    const whereBase = {
      tenantId,
      ...(filtros.filialId && { filialId: filtros.filialId }),
      status: { in: [StatusFinanceiro.PAGO, StatusFinanceiro.PARCIAL] },
      dataPagamento: {
        not: null,
        ...(inicio && { gte: inicio }),
        ...(fim && { lte: fim }),
      },
    };

    const [recebidos, pagos] = await Promise.all([
      this.prisma.contaReceber.findMany({
        where: whereBase,
        select: { valorPago: true, dataPagamento: true },
      }),
      this.prisma.contaPagar.findMany({
        where: whereBase,
        select: { valorPago: true, dataPagamento: true },
      }),
    ]);

    // Agrega por período (chave de competência).
    const mapa = new Map<string, { entradas: number[]; saidas: number[] }>();
    const chave = (d: Date) =>
      agrupamento === 'dia'
        ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 7);

    const bucket = (k: string) => {
      if (!mapa.has(k)) mapa.set(k, { entradas: [], saidas: [] });
      return mapa.get(k)!;
    };

    for (const r of recebidos) {
      if (!r.dataPagamento) continue;
      bucket(chave(r.dataPagamento)).entradas.push(money(r.valorPago));
    }
    for (const p of pagos) {
      if (!p.dataPagamento) continue;
      bucket(chave(p.dataPagamento)).saidas.push(money(p.valorPago));
    }

    // Ordena cronologicamente e calcula o saldo acumulado corrente.
    const periodos: Periodo[] = [];
    let acumulado = 0;
    for (const k of Array.from(mapa.keys()).sort()) {
      const b = mapa.get(k)!;
      const entradas = sumMoney(b.entradas);
      const saidas = sumMoney(b.saidas);
      const saldoPeriodo = subMoney(entradas, saidas);
      acumulado = subMoney(acumulado + saldoPeriodo, 0);
      periodos.push({ periodo: k, entradas, saidas, saldoPeriodo, saldoAcumulado: acumulado });
    }

    const totalEntradas = sumMoney(periodos.map((p) => p.entradas));
    const totalSaidas = sumMoney(periodos.map((p) => p.saidas));

    return {
      agrupamento,
      periodos,
      kpis: {
        totalEntradas,
        totalSaidas,
        saldoLiquido: subMoney(totalEntradas, totalSaidas),
        periodos: periodos.length,
      },
    };
  }

  private inicioDoDia(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  private fimDoDia(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }
}
