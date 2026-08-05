import { Injectable } from '@nestjs/common';
import { TipoMovimento, OrigemMovimento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, sumMoney, subMoney } from '../../common/utils/money.util';

/** Filtros do consolidado de fluxo de caixa. */
export interface FluxoCaixaDto {
  filialId?: string;
  dataIni?: string; // competência: data do movimento >= dataIni
  dataFim?: string; // competência: data do movimento <= dataFim
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
   * Visão de Caixa REALIZADO: considera tudo que efetivamente entrou/saiu das
   * contas financeiras — o razão `movimentoCaixa`. Isso cobre vendas do PDV,
   * sangrias/suprimentos, baixas de contas a receber/pagar e lançamentos avulsos,
   * pela data do movimento. Transferências entre contas próprias são excluídas
   * (movimento interno, não é entrada/saída de caixa do negócio). Agrupa por
   * competência (dia ou mês) e calcula o saldo líquido corrente (saldo acumulado).
   */
  async consolidado(tenantId: string, filtros: FluxoCaixaDto = {}) {
    const agrupamento = filtros.agrupamento === 'dia' ? 'dia' : 'mes';
    const inicio = filtros.dataIni ? this.inicioDoDia(new Date(filtros.dataIni)) : undefined;
    const fim = filtros.dataFim ? this.fimDoDia(new Date(filtros.dataFim)) : undefined;

    const movimentos = await this.prisma.movimentoCaixa.findMany({
      where: {
        tenantId,
        ...(filtros.filialId && { filialId: filtros.filialId }),
        // Transferência = dinheiro trocando de conta própria; não é fluxo de caixa
        // do negócio (os dois lados se anulam), então fica de fora do consolidado.
        origem: { not: OrigemMovimento.TRANSFERENCIA },
        data: {
          ...(inicio && { gte: inicio }),
          ...(fim && { lte: fim }),
        },
      },
      select: { valor: true, tipo: true, data: true },
    });

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

    for (const m of movimentos) {
      const b = bucket(chave(m.data));
      if (m.tipo === TipoMovimento.ENTRADA) b.entradas.push(money(m.valor));
      else b.saidas.push(money(m.valor));
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
