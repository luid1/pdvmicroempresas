import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, StatusFinanceiro } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TesourariaService } from '../tesouraria/tesouraria.service';
import { TipoMovimento, OrigemMovimento } from '@prisma/client';
import {
  money,
  subMoney,
  sumMoney,
  ratearParcelas,
  assertValorPositivo,
} from '../../common/utils/money.util';

/** Filtros da listagem de Contas a Receber. */
export interface ListarReceberDto {
  status?: StatusFinanceiro;
  clienteId?: string;
  filialId?: string;
  dataIni?: string; // filtra por dataVencimento >= dataIni
  dataFim?: string; // filtra por dataVencimento <= dataFim
  search?: string;
}

/** Criação manual de um título a receber (com parcelamento opcional). */
export interface CriarReceberDto {
  clienteId?: string;
  filialId?: string;
  pedidoId?: string;
  nfeId?: string;
  descricao: string;
  numero?: string;
  valorTotal: number;
  dataCompetencia?: string; // regime de competência (default: hoje)
  dataVencimento: string; // 1ª parcela / vencimento único
  parcelas?: number; // default 1
  intervaloDias?: number; // dias entre parcelas (default 30)
  formaPagamento?: string;
  observacoes?: string;
}

/** Baixa (recebimento) total ou parcial de um título. */
export interface BaixarReceberDto {
  valor: number; // valor recebido nesta operação
  dataPagamento?: string;
  valorDesconto?: number;
  valorJuros?: number;
  formaPagamento?: string;
  observacoes?: string;
  contaId?: string; // conta financeira creditada (gera MovimentoCaixa)
}

/** Contexto do usuário autenticado (para a trilha de auditoria). */
export interface UsuarioCtx {
  id: string;
  nome?: string;
}

@Injectable()
export class ContasReceberService {
  constructor(
    private prisma: PrismaService,
    private tesouraria: TesourariaService,
  ) {}

  // ───────────────────────── Leitura ─────────────────────────

  /**
   * Lista títulos a receber. Antes de retornar, promove a VENCIDO todos os
   * títulos em aberto/parcial cujo vencimento já passou (mantém o status coerente).
   */
  async findAll(tenantId: string, filtros: ListarReceberDto = {}) {
    await this.marcarVencidas(tenantId);

    const where: Prisma.ContaReceberWhereInput = {
      tenantId,
      ...(filtros.status && { status: filtros.status }),
      ...(filtros.clienteId && { clienteId: filtros.clienteId }),
      ...(filtros.filialId && { filialId: filtros.filialId }),
      ...((filtros.dataIni || filtros.dataFim) && {
        dataVencimento: {
          ...(filtros.dataIni && { gte: new Date(filtros.dataIni) }),
          ...(filtros.dataFim && { lte: this.fimDoDia(filtros.dataFim) }),
        },
      }),
      ...(filtros.search && {
        OR: [
          { descricao: { contains: filtros.search, mode: 'insensitive' } },
          { numero: { contains: filtros.search, mode: 'insensitive' } },
        ],
      }),
    };

    const registros = await this.prisma.contaReceber.findMany({
      where,
      include: { cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
      orderBy: [{ dataVencimento: 'asc' }],
    });

    return registros.map((c) => this.serializar(c));
  }

  /** Totais consolidados do período (para os KPIs da tela). */
  async resumo(tenantId: string, filtros: ListarReceberDto = {}) {
    const contas = await this.findAll(tenantId, filtros);
    const porStatus = (s: StatusFinanceiro) => contas.filter((c) => c.status === s);

    return {
      totalTitulos: contas.length,
      valorOriginalTotal: sumMoney(contas.map((c) => c.valorOriginal)),
      valorRecebido: sumMoney(contas.map((c) => c.valorPago)),
      valorEmAberto: sumMoney(contas.map((c) => c.valorAberto)),
      abertos: porStatus('ABERTO').length,
      parciais: porStatus('PARCIAL').length,
      pagos: porStatus('PAGO').length,
      vencidos: porStatus('VENCIDO').length,
      valorVencido: sumMoney(porStatus('VENCIDO').map((c) => c.valorAberto)),
    };
  }

  async findOne(tenantId: string, id: string) {
    const conta = await this.prisma.contaReceber.findFirst({
      where: { id, tenantId },
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        historicos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!conta) throw new NotFoundException('Conta a receber não encontrada.');
    return this.serializar(conta);
  }

  // ───────────────────────── Escrita ─────────────────────────

  /**
   * Cria um ou mais títulos a receber. Se `parcelas > 1`, rateia o valor total
   * em N parcelas (sem drift de centavos) e gera um vencimento por parcela.
   * Registra a criação na trilha de auditoria.
   */
  async create(tenantId: string, usuario: UsuarioCtx, dto: CriarReceberDto) {
    const valorTotal = assertValorPositivo(dto.valorTotal, 'valorTotal');
    if (!dto.descricao?.trim()) throw new BadRequestException('Informe a descrição.');
    if (!dto.dataVencimento) throw new BadRequestException('Informe a data de vencimento.');

    const parcelas = Math.max(1, Math.floor(dto.parcelas || 1));
    const intervalo = dto.intervaloDias ?? 30;
    const valores = ratearParcelas(valorTotal, parcelas);
    const vencimentoBase = new Date(dto.dataVencimento);
    const competencia = dto.dataCompetencia ? new Date(dto.dataCompetencia) : new Date();

    const criadas = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (let i = 0; i < parcelas; i++) {
        const dataVencimento = this.addDias(vencimentoBase, i * intervalo);
        const numero =
          parcelas > 1 ? `${dto.numero || 'REC'}-${i + 1}/${parcelas}` : dto.numero || null;

        const conta = await tx.contaReceber.create({
          data: {
            tenantId,
            clienteId: dto.clienteId || null,
            filialId: dto.filialId || null,
            pedidoId: dto.pedidoId || null,
            nfeId: dto.nfeId || null,
            descricao:
              parcelas > 1 ? `${dto.descricao} (${i + 1}/${parcelas})` : dto.descricao,
            numero,
            valorOriginal: valores[i],
            dataEmissao: competencia,
            dataVencimento,
            status: StatusFinanceiro.ABERTO,
            formaPagamento: dto.formaPagamento || null,
            observacoes: dto.observacoes || null,
          },
        });

        await tx.historicoFinanceiro.create({
          data: {
            tenantId,
            contaReceberId: conta.id,
            tipoConta: 'RECEBER',
            acao: 'CRIACAO',
            statusAnterior: null,
            statusNovo: StatusFinanceiro.ABERTO,
            valorMovimentado: valores[i],
            valorPagoAcumulado: 0,
            usuarioId: usuario.id,
            usuarioNome: usuario.nome || null,
            observacoes: `Título gerado (${i + 1}/${parcelas}).`,
          },
        });

        out.push(conta);
      }
      return out;
    });

    return criadas.map((c) => this.serializar(c));
  }

  /**
   * Baixa (recebimento) total ou parcial. Protegido por RBAC 'FINANCEIRO:OPERAR'
   * no controller. Recalcula o status, grava dataPagamento e registra a operação
   * na trilha de auditoria (usuário, timestamp, valor).
   */
  async baixar(
    tenantId: string,
    usuario: UsuarioCtx,
    id: string,
    dto: BaixarReceberDto,
  ) {
    const valorRecebido = assertValorPositivo(dto.valor, 'valor');
    const desconto = money(dto.valorDesconto || 0);
    const juros = money(dto.valorJuros || 0);

    return this.prisma.$transaction(async (tx) => {
      const conta = await tx.contaReceber.findFirst({ where: { id, tenantId } });
      if (!conta) throw new NotFoundException('Conta a receber não encontrada.');
      if (conta.status === StatusFinanceiro.PAGO)
        throw new BadRequestException('Título já está quitado.');
      if (conta.status === StatusFinanceiro.CANCELADO)
        throw new BadRequestException('Título cancelado não pode ser baixado.');

      const statusAnterior = conta.status;
      const valorOriginal = money(conta.valorOriginal);
      const descontoAcum = money(subMoney(conta.valorDesconto, 0)) + desconto;
      const jurosAcum = money(subMoney(conta.valorJuros, 0)) + juros;
      const novoValorPago = sumMoney([conta.valorPago, valorRecebido]);

      // Quitação: valor pago + descontos concedidos >= valor original + juros
      const totalDevido = subMoney(valorOriginal + jurosAcum, descontoAcum);
      const restante = subMoney(totalDevido, novoValorPago);
      if (restante < -0.005)
        throw new BadRequestException(
          `Valor recebido excede o saldo devedor. Saldo: ${subMoney(totalDevido, conta.valorPago)}`,
        );

      const quitado = restante <= 0.005;
      const statusNovo = quitado ? StatusFinanceiro.PAGO : StatusFinanceiro.PARCIAL;

      const atualizada = await tx.contaReceber.update({
        where: { id: conta.id },
        data: {
          valorPago: novoValorPago,
          valorDesconto: descontoAcum,
          valorJuros: jurosAcum,
          status: statusNovo,
          dataPagamento: quitado
            ? dto.dataPagamento
              ? new Date(dto.dataPagamento)
              : new Date()
            : conta.dataPagamento,
          formaPagamento: dto.formaPagamento || conta.formaPagamento,
        },
      });

      await tx.historicoFinanceiro.create({
        data: {
          tenantId,
          contaReceberId: conta.id,
          tipoConta: 'RECEBER',
          acao: quitado ? 'BAIXA' : 'BAIXA_PARCIAL',
          statusAnterior,
          statusNovo,
          valorMovimentado: valorRecebido,
          valorPagoAcumulado: novoValorPago,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome || null,
          observacoes:
            dto.observacoes ||
            `Recebimento ${quitado ? 'total' : 'parcial'}${dto.formaPagamento ? ` via ${dto.formaPagamento}` : ''}.`,
        },
      });

      // Tesouraria: se a baixa indicou uma conta financeira, registra a entrada
      // de caixa correspondente (atualiza saldo + gera MovimentoCaixa conciliável).
      if (dto.contaId) {
        await this.tesouraria.registrarMovimentoTx(tx, {
          tenantId,
          contaId: dto.contaId,
          filialId: conta.filialId,
          tipo: TipoMovimento.ENTRADA,
          valor: valorRecebido,
          descricao: `Recebimento: ${conta.descricao}`,
          origem: OrigemMovimento.BAIXA_RECEBER,
          contaReceberId: conta.id,
          data: dto.dataPagamento ? new Date(dto.dataPagamento) : new Date(),
          usuario,
          observacoes: dto.formaPagamento ? `Via ${dto.formaPagamento}` : null,
        });
      }

      return this.serializar(atualizada);
    });
  }

  /** Cancela um título (com trilha). Não permite cancelar título já pago. */
  async cancelar(tenantId: string, usuario: UsuarioCtx, id: string, motivo?: string) {
    return this.prisma.$transaction(async (tx) => {
      const conta = await tx.contaReceber.findFirst({ where: { id, tenantId } });
      if (!conta) throw new NotFoundException('Conta a receber não encontrada.');
      if (conta.status === StatusFinanceiro.PAGO)
        throw new BadRequestException('Título quitado não pode ser cancelado.');

      const atualizada = await tx.contaReceber.update({
        where: { id: conta.id },
        data: { status: StatusFinanceiro.CANCELADO },
      });

      await tx.historicoFinanceiro.create({
        data: {
          tenantId,
          contaReceberId: conta.id,
          tipoConta: 'RECEBER',
          acao: 'CANCELAMENTO',
          statusAnterior: conta.status,
          statusNovo: StatusFinanceiro.CANCELADO,
          valorMovimentado: 0,
          valorPagoAcumulado: money(conta.valorPago),
          usuarioId: usuario.id,
          usuarioNome: usuario.nome || null,
          observacoes: motivo || 'Título cancelado.',
        },
      });

      return this.serializar(atualizada);
    });
  }

  // ─────────────── Integração com Estoque/Vendas ───────────────

  /**
   * INTEGRAÇÃO (coração do ERP): quando uma NF-e de venda é emitida, o módulo de
   * NF-e emite o evento 'nfe.emitida'. Aqui geramos os títulos a receber de forma
   * IDEMPOTENTE (não duplica se já existir título para a mesma NF-e), garantindo
   * que toda saída de estoque por venda tenha o correspondente em Contas a Receber.
   *
   * Observação: o fluxo principal por duplicatas continua no NFeService; este
   * listener é a rede de segurança para vendas sem duplicata explícita.
   */
  @OnEvent('nfe.emitida')
  async onNfeEmitida(payload: {
    tenantId: string;
    nfeId: string;
    filialId?: string;
    clienteId?: string;
    valorNfe?: unknown;
    duplicatas?: any[];
    formaPagamento?: string;
    usuarioId: string;
  }) {
    try {
      const { tenantId, nfeId } = payload;
      if (!tenantId || !nfeId) return;

      const jaExiste = await this.prisma.contaReceber.count({
        where: { tenantId, nfeId },
      });
      if (jaExiste > 0) return; // idempotência: NFeService já gerou os títulos

      const temDuplicatas = Array.isArray(payload.duplicatas) && payload.duplicatas.length > 0;
      if (temDuplicatas) return; // caminho canônico (duplicatas) é tratado pelo NFeService

      const valor = money(payload.valorNfe);
      if (valor <= 0) return;

      await this.create(
        tenantId,
        { id: payload.usuarioId, nome: 'Sistema (NF-e)' },
        {
          clienteId: payload.clienteId,
          filialId: payload.filialId,
          nfeId,
          descricao: `Venda — NF-e ${nfeId.slice(0, 8)}`,
          valorTotal: valor,
          dataVencimento: this.addDias(new Date(), 30).toISOString(),
          formaPagamento: payload.formaPagamento,
          observacoes: 'Gerado automaticamente a partir da emissão da NF-e.',
        },
      );
    } catch {
      // Falha na geração automática nunca deve derrubar a emissão da NF-e.
    }
  }

  // ───────────────────────── Helpers ─────────────────────────

  /** Promove a VENCIDO títulos em aberto/parcial com vencimento no passado. */
  private async marcarVencidas(tenantId: string) {
    await this.prisma.contaReceber.updateMany({
      where: {
        tenantId,
        status: { in: [StatusFinanceiro.ABERTO, StatusFinanceiro.PARCIAL] },
        dataVencimento: { lt: this.inicioDoDia(new Date()) },
      },
      data: { status: StatusFinanceiro.VENCIDO },
    });
  }

  /** Serializa o registro Prisma para números seguros + campo derivado valorAberto. */
  private serializar(c: any) {
    const valorOriginal = money(c.valorOriginal);
    const valorPago = money(c.valorPago);
    const valorDesconto = money(c.valorDesconto);
    const valorJuros = money(c.valorJuros);
    const valorAberto = Math.max(
      0,
      subMoney(valorOriginal + valorJuros, valorPago + valorDesconto),
    );
    return {
      ...c,
      valorOriginal,
      valorPago,
      valorDesconto,
      valorJuros,
      valorAberto,
    };
  }

  private addDias(base: Date, dias: number) {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    return d;
  }
  private inicioDoDia(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  private fimDoDia(iso: string) {
    const x = new Date(iso);
    x.setHours(23, 59, 59, 999);
    return x;
  }
}
