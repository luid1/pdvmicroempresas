import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PeriodicidadeRecorrencia, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContasPagarService, UsuarioCtx } from '../contas-pagar/contas-pagar.service';
import { money, toNumber } from '../../common/utils/money.util';
import { CriarRecorrenciaDto, AtualizarRecorrenciaDto } from './dto/recorrencia.dto';

/** Usuário do sistema usado quando a geração é automática (cron interno). */
const SYSTEM_CTX: UsuarioCtx = { id: 'SYSTEM', nome: 'Sistema (recorrência)' };

/** Meses avançados por periodicidade (SEMANAL/QUINZENAL tratados em dias). */
const MESES_POR_PERIODICIDADE: Record<PeriodicidadeRecorrencia, number> = {
  SEMANAL: 0,
  QUINZENAL: 0,
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

const DIAS_POR_PERIODICIDADE: Partial<Record<PeriodicidadeRecorrencia, number>> = {
  SEMANAL: 7,
  QUINZENAL: 15,
};

@Injectable()
export class RecorrenciasService implements OnModuleInit {
  private readonly logger = new Logger(RecorrenciasService.name);
  private timer: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(
    private prisma: PrismaService,
    private contasPagar: ContasPagarService,
  ) {}

  // ───────────────────────── Scheduler interno ─────────────────────────

  onModuleInit() {
    // Verifica a cada 1h se há recorrências vencidas para gerar. A primeira
    // varredura ocorre ~30s após o boot (dá tempo do app estabilizar).
    const UMA_HORA = 60 * 60 * 1000;
    setTimeout(() => this.varrerSilencioso(), 30 * 1000);
    this.timer = setInterval(() => this.varrerSilencioso(), UMA_HORA);
    if (this.timer.unref) this.timer.unref();
  }

  private async varrerSilencioso() {
    try {
      const r = await this.gerarDevidas();
      if (r.geradas > 0) {
        this.logger.log(`Recorrências: ${r.geradas} conta(s) a pagar geradas automaticamente.`);
      }
    } catch (e) {
      this.logger.error('Falha ao gerar recorrências automáticas', e as Error);
    }
  }

  // ───────────────────────── Serialização ─────────────────────────

  private serializar(r: any) {
    return {
      ...r,
      valor: toNumber(r.valor),
    };
  }

  // ───────────────────────── CRUD ─────────────────────────

  async listar(tenantId: string, ativo?: boolean) {
    const rows = await this.prisma.despesaRecorrente.findMany({
      where: { tenantId, ...(ativo !== undefined ? { ativo } : {}) },
      orderBy: [{ ativo: 'desc' }, { proximaGeracao: 'asc' }],
    });
    return rows.map((r) => this.serializar(r));
  }

  async findOne(tenantId: string, id: string) {
    const r = await this.prisma.despesaRecorrente.findFirst({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Recorrência não encontrada.');
    return this.serializar(r);
  }

  async criar(tenantId: string, dto: CriarRecorrenciaDto) {
    if (!dto.descricao?.trim()) throw new BadRequestException('Informe a descrição.');
    const diaVencimento = dto.diaVencimento ?? 1;
    const periodicidade = dto.periodicidade ?? PeriodicidadeRecorrencia.MENSAL;
    const valorVariavel = dto.valorVariavel ?? false;
    const valor = valorVariavel ? 0 : money(dto.valor ?? 0);

    if (!valorVariavel && valor <= 0) {
      throw new BadRequestException('Informe um valor maior que zero (ou marque valorVariavel).');
    }

    const proximaGeracao = dto.proximaGeracao
      ? new Date(dto.proximaGeracao)
      : this.calcularProximoVencimento(new Date(), diaVencimento);

    const r = await this.prisma.despesaRecorrente.create({
      data: {
        tenantId,
        filialId: dto.filialId || null,
        fornecedorId: dto.fornecedorId || null,
        descricao: dto.descricao.trim(),
        valor: new Prisma.Decimal(valor),
        valorVariavel,
        planoContasCodigo: dto.planoContasCodigo || null,
        diaVencimento,
        periodicidade,
        proximaGeracao,
        observacoes: dto.observacoes || null,
        ativo: true,
      },
    });
    return this.serializar(r);
  }

  async atualizar(tenantId: string, id: string, dto: AtualizarRecorrenciaDto) {
    await this.findOne(tenantId, id);
    const data: Prisma.DespesaRecorrenteUpdateInput = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao.trim();
    if (dto.fornecedorId !== undefined) data.fornecedorId = dto.fornecedorId || null;
    if (dto.valor !== undefined) data.valor = new Prisma.Decimal(money(dto.valor));
    if (dto.valorVariavel !== undefined) data.valorVariavel = dto.valorVariavel;
    if (dto.planoContasCodigo !== undefined)
      data.planoContasCodigo = dto.planoContasCodigo || null;
    if (dto.diaVencimento !== undefined) data.diaVencimento = dto.diaVencimento;
    if (dto.periodicidade !== undefined) data.periodicidade = dto.periodicidade;
    if (dto.proximaGeracao !== undefined) data.proximaGeracao = new Date(dto.proximaGeracao);
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes || null;

    const r = await this.prisma.despesaRecorrente.update({ where: { id }, data });
    return this.serializar(r);
  }

  async remover(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.despesaRecorrente.delete({ where: { id } });
    return { ok: true };
  }

  // ───────────────────────── Preview ─────────────────────────

  /** Retorna as próximas N ocorrências (datas/valores) sem gerar nada. */
  async preview(tenantId: string, id: string, quantidade = 6) {
    const r = await this.findOne(tenantId, id);
    const n = Math.min(24, Math.max(1, quantidade));
    const out: { data: string; periodo: string; valor: number; rascunho: boolean }[] = [];
    let cursor = new Date(r.proximaGeracao);
    for (let i = 0; i < n; i++) {
      out.push({
        data: cursor.toISOString(),
        periodo: this.chavePeriodo(cursor),
        valor: r.valor,
        rascunho: r.valorVariavel,
      });
      cursor = this.avancar(cursor, r.periodicidade, r.diaVencimento);
    }
    return out;
  }

  // ───────────────────────── Geração ─────────────────────────

  /**
   * Gera as Contas a Pagar de todas as recorrências ativas cujo
   * `proximaGeracao <= agora`. Idempotente por `ultimoPeriodoGerado`.
   */
  async gerarDevidas(tenantId?: string) {
    if (this.rodando) return { geradas: 0, detalhes: [] as any[] };
    this.rodando = true;
    try {
      const agora = new Date();
      const devidas = await this.prisma.despesaRecorrente.findMany({
        where: {
          ativo: true,
          proximaGeracao: { lte: agora },
          ...(tenantId ? { tenantId } : {}),
        },
      });

      const detalhes: any[] = [];
      let geradas = 0;

      for (const rec of devidas) {
        try {
          const alvo = new Date(rec.proximaGeracao);
          const periodo = this.chavePeriodo(alvo);

          // Idempotência: se este período já foi gerado, apenas avança o cursor.
          if (rec.ultimoPeriodoGerado === periodo) {
            await this.avancarCursor(rec.id, rec.periodicidade, alvo, rec.diaVencimento, periodo, false);
            continue;
          }

          const usuario = SYSTEM_CTX;
          const valor = toNumber(rec.valor);
          const criarValorVariavel = rec.valorVariavel;

          const contas = await this.contasPagar.create(rec.tenantId, usuario, {
            fornecedorId: rec.fornecedorId || undefined,
            filialId: rec.filialId || undefined,
            descricao: `${rec.descricao} — ${periodo}`,
            valorTotal: criarValorVariavel ? 0.01 : valor, // rascunho: placeholder mínimo
            dataVencimento: alvo.toISOString(),
            planoContasCodigo: rec.planoContasCodigo || undefined,
            observacoes: `RECORRENCIA=${rec.id} PERIODO=${periodo}${
              criarValorVariavel ? ' [RASCUNHO: ajustar valor]' : ''
            }`,
          });

          geradas += 1;
          detalhes.push({
            recorrenciaId: rec.id,
            descricao: rec.descricao,
            periodo,
            contaPagarId: contas?.[0]?.id,
            rascunho: criarValorVariavel,
          });

          await this.avancarCursor(
            rec.id,
            rec.periodicidade,
            alvo,
            rec.diaVencimento,
            periodo,
            true,
          );
        } catch (e) {
          this.logger.error(`Falha ao gerar recorrência ${rec.id}`, e as Error);
          detalhes.push({ recorrenciaId: rec.id, erro: (e as Error).message });
        }
      }

      return { geradas, detalhes };
    } finally {
      this.rodando = false;
    }
  }

  private async avancarCursor(
    id: string,
    periodicidade: PeriodicidadeRecorrencia,
    base: Date,
    diaVencimento: number,
    periodo: string,
    marcarGerado: boolean,
  ) {
    const proxima = this.avancar(base, periodicidade, diaVencimento);
    await this.prisma.despesaRecorrente.update({
      where: { id },
      data: {
        proximaGeracao: proxima,
        ...(marcarGerado
          ? { ultimaGeracao: new Date(), ultimoPeriodoGerado: periodo }
          : {}),
      },
    });
  }

  // ───────────────────────── Datas ─────────────────────────

  /** Chave de idempotência do período (AAAA-MM-DD para curtos, AAAA-MM p/ mensais+). */
  private chavePeriodo(d: Date): string {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /** Próximo vencimento no dia informado (este mês se ainda não passou, senão o próximo). */
  private calcularProximoVencimento(hoje: Date, dia: number): Date {
    const alvo = this.comDia(hoje.getFullYear(), hoje.getMonth(), dia);
    if (alvo.getTime() >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) {
      return alvo;
    }
    return this.comDia(hoje.getFullYear(), hoje.getMonth() + 1, dia);
  }

  /** Avança a data conforme a periodicidade, respeitando o dia de vencimento. */
  private avancar(base: Date, periodicidade: PeriodicidadeRecorrencia, dia: number): Date {
    const emDias = DIAS_POR_PERIODICIDADE[periodicidade];
    if (emDias) {
      const d = new Date(base);
      d.setDate(d.getDate() + emDias);
      return d;
    }
    const meses = MESES_POR_PERIODICIDADE[periodicidade] || 1;
    return this.comDia(base.getFullYear(), base.getMonth() + meses, dia);
  }

  /** Cria uma data no ano/mês pedido com `dia` clampado ao último dia do mês. */
  private comDia(ano: number, mes: number, dia: number): Date {
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const d = Math.min(Math.max(1, dia), ultimoDia);
    return new Date(ano, mes, d);
  }
}
