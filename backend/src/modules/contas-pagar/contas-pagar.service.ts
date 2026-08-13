import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, StatusFinanceiro } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanoContasService } from '../plano-contas/plano-contas.service';
import { TesourariaService } from '../tesouraria/tesouraria.service';
import { TipoMovimento, OrigemMovimento } from '@prisma/client';
import {
  money,
  subMoney,
  sumMoney,
  ratearParcelas,
  assertValorPositivo,
} from '../../common/utils/money.util';

/** Filtros da listagem de Contas a Pagar. */
export interface ListarPagarDto {
  status?: StatusFinanceiro;
  fornecedorId?: string;
  filialId?: string;
  dataIni?: string; // filtra por dataVencimento >= dataIni
  dataFim?: string; // filtra por dataVencimento <= dataFim
  search?: string;
}

/** Criação manual de um título a pagar (com parcelamento opcional). */
export interface CriarPagarDto {
  fornecedorId?: string;
  filialId?: string;
  entradaId?: string;
  descricao: string;
  numero?: string;
  valorTotal: number;
  dataCompetencia?: string; // regime de competência (default: hoje)
  dataVencimento: string; // 1ª parcela / vencimento único
  parcelas?: number; // default 1
  intervaloDias?: number; // dias entre parcelas (default 30)
  formaPagamento?: string;
  observacoes?: string;
  /** Código do plano de contas (categoria de despesa) → gera lançamento no DRE. */
  planoContasCodigo?: string;
}

/** Baixa (pagamento) total ou parcial de um título. */
export interface BaixarPagarDto {
  valor: number; // valor pago nesta operação
  dataPagamento?: string;
  valorDesconto?: number;
  valorJuros?: number;
  formaPagamento?: string;
  observacoes?: string;
  contaId?: string; // conta financeira debitada (gera MovimentoCaixa)
}

/** Contexto do usuário autenticado (para a trilha de auditoria). */
export interface UsuarioCtx {
  id: string;
  nome?: string;
}

@Injectable()
export class ContasPagarService {
  constructor(
    private prisma: PrismaService,
    private planoContas: PlanoContasService,
    private tesouraria: TesourariaService,
  ) {}

  // ───────────────────────── Leitura ─────────────────────────

  /**
   * Lista títulos a pagar. Antes de retornar, promove a VENCIDO todos os
   * títulos em aberto/parcial cujo vencimento já passou (mantém o status coerente).
   */
  async findAll(tenantId: string, filtros: ListarPagarDto = {}) {
    await this.marcarVencidas(tenantId);

    const where: Prisma.ContaPagarWhereInput = {
      tenantId,
      ...(filtros.status && { status: filtros.status }),
      ...(filtros.fornecedorId && { fornecedorId: filtros.fornecedorId }),
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

    const registros = await this.prisma.contaPagar.findMany({
      where,
      include: {
        fornecedor: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
      orderBy: [{ dataVencimento: 'asc' }],
    });

    return registros.map((c) => this.serializar(c));
  }

  /** Totais consolidados do período (para os KPIs da tela). */
  async resumo(tenantId: string, filtros: ListarPagarDto = {}) {
    const contas = await this.findAll(tenantId, filtros);
    const porStatus = (s: StatusFinanceiro) => contas.filter((c) => c.status === s);

    return {
      totalTitulos: contas.length,
      valorOriginalTotal: sumMoney(contas.map((c) => c.valorOriginal)),
      valorPago: sumMoney(contas.map((c) => c.valorPago)),
      valorEmAberto: sumMoney(contas.map((c) => c.valorAberto)),
      abertos: porStatus('ABERTO').length,
      parciais: porStatus('PARCIAL').length,
      pagos: porStatus('PAGO').length,
      vencidos: porStatus('VENCIDO').length,
      valorVencido: sumMoney(porStatus('VENCIDO').map((c) => c.valorAberto)),
    };
  }

  async findOne(tenantId: string, id: string) {
    const conta = await this.prisma.contaPagar.findFirst({
      where: { id, tenantId },
      include: {
        fornecedor: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        historicos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!conta) throw new NotFoundException('Conta a pagar não encontrada.');
    return this.serializar(conta);
  }

  // ───────────────────────── Escrita ─────────────────────────

  /**
   * Cria um ou mais títulos a pagar. Se `parcelas > 1`, rateia o valor total
   * em N parcelas (sem drift de centavos) e gera um vencimento por parcela.
   * Registra a criação na trilha de auditoria.
   */
  async create(tenantId: string, usuario: UsuarioCtx, dto: CriarPagarDto) {
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
          parcelas > 1 ? `${dto.numero || 'PAG'}-${i + 1}/${parcelas}` : dto.numero || null;

        const conta = await tx.contaPagar.create({
          data: {
            tenantId,
            fornecedorId: dto.fornecedorId || null,
            filialId: dto.filialId || null,
            entradaId: dto.entradaId || null,
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
            contaPagarId: conta.id,
            tipoConta: 'PAGAR',
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

        // Reconhecimento da despesa no DRE (regime de competência), se houver
        // categoria (plano de contas). Idempotente pela origem CP:<id>.
        if (dto.planoContasCodigo) {
          await this.planoContas.lancar({
            tenantId,
            filialId: dto.filialId || null,
            contaCodigo: dto.planoContasCodigo,
            valor: valores[i],
            dataCompetencia: competencia,
            descricao: conta.descricao,
            origem: `CP:${conta.id}`,
            tx,
          });
        }

        out.push(conta);
      }
      return out;
    });

    return criadas.map((c) => this.serializar(c));
  }

  /**
   * Baixa (pagamento) total ou parcial. Protegido por RBAC 'FINANCEIRO:OPERAR'
   * no controller. Recalcula o status, grava dataPagamento e registra a operação
   * na trilha de auditoria (usuário, timestamp, valor).
   */
  async baixar(tenantId: string, usuario: UsuarioCtx, id: string, dto: BaixarPagarDto) {
    const valorPagoOp = assertValorPositivo(dto.valor, 'valor');
    const desconto = money(dto.valorDesconto || 0);
    const juros = money(dto.valorJuros || 0);

    return this.prisma.$transaction(async (tx) => {
      const conta = await tx.contaPagar.findFirst({ where: { id, tenantId } });
      if (!conta) throw new NotFoundException('Conta a pagar não encontrada.');
      if (conta.status === StatusFinanceiro.PAGO)
        throw new BadRequestException('Título já está quitado.');
      if (conta.status === StatusFinanceiro.CANCELADO)
        throw new BadRequestException('Título cancelado não pode ser baixado.');

      const statusAnterior = conta.status;
      const valorOriginal = money(conta.valorOriginal);
      const descontoAcum = money(subMoney(conta.valorDesconto, 0)) + desconto;
      const jurosAcum = money(subMoney(conta.valorJuros, 0)) + juros;
      const novoValorPago = sumMoney([conta.valorPago, valorPagoOp]);

      const totalDevido = subMoney(valorOriginal + jurosAcum, descontoAcum);
      const restante = subMoney(totalDevido, novoValorPago);
      if (restante < -0.005)
        throw new BadRequestException(
          `Valor pago excede o saldo devedor. Saldo: ${subMoney(totalDevido, conta.valorPago)}`,
        );

      const quitado = restante <= 0.005;
      const statusNovo = quitado ? StatusFinanceiro.PAGO : StatusFinanceiro.PARCIAL;

      const atualizada = await tx.contaPagar.update({
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
          contaPagarId: conta.id,
          tipoConta: 'PAGAR',
          acao: quitado ? 'BAIXA' : 'BAIXA_PARCIAL',
          statusAnterior,
          statusNovo,
          valorMovimentado: valorPagoOp,
          valorPagoAcumulado: novoValorPago,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome || null,
          observacoes:
            dto.observacoes ||
            `Pagamento ${quitado ? 'total' : 'parcial'}${dto.formaPagamento ? ` via ${dto.formaPagamento}` : ''}.`,
        },
      });

      // Tesouraria: se a baixa indicou uma conta financeira, registra a saída de
      // caixa correspondente (atualiza saldo + gera MovimentoCaixa conciliável).
      if (dto.contaId) {
        await this.tesouraria.registrarMovimentoTx(tx, {
          tenantId,
          contaId: dto.contaId,
          filialId: conta.filialId,
          tipo: TipoMovimento.SAIDA,
          valor: valorPagoOp,
          descricao: `Pagamento: ${conta.descricao}`,
          origem: OrigemMovimento.BAIXA_PAGAR,
          contaPagarId: conta.id,
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
      const conta = await tx.contaPagar.findFirst({ where: { id, tenantId } });
      if (!conta) throw new NotFoundException('Conta a pagar não encontrada.');
      if (conta.status === StatusFinanceiro.PAGO)
        throw new BadRequestException('Título quitado não pode ser cancelado.');

      const atualizada = await tx.contaPagar.update({
        where: { id: conta.id },
        data: { status: StatusFinanceiro.CANCELADO },
      });

      // Estorna o reconhecimento da despesa no DRE (se houver).
      await this.planoContas.estornar(tenantId, `CP:${conta.id}`, tx);

      await tx.historicoFinanceiro.create({
        data: {
          tenantId,
          contaPagarId: conta.id,
          tipoConta: 'PAGAR',
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

  // ─────────────── Integração com Estoque/Compras ───────────────

  /**
   * INTEGRAÇÃO (coração do ERP): toda ENTRADA de mercadoria por compra gera um
   * título a pagar. O módulo de Estoque emite 'estoque.entrada_compra' por item
   * movimentado; aqui geramos UM título a pagar por ENTRADA (idempotente pelo
   * entradaId), com o valor total da nota de entrada.
   *
   * O EntradasService já cria a ContaPagar quando `gerarContaPagar` é marcado;
   * a checagem de existência por entradaId evita duplicidade — este listener é a
   * rede de segurança que garante o título mesmo quando a flag não foi enviada.
   */
  @OnEvent('estoque.entrada_compra')
  async onEntradaCompra(payload: {
    tenantId: string;
    entradaId?: string;
    filialId?: string;
    usuarioId?: string;
    custoUnitario?: number;
    quantidade?: number;
  }) {
    try {
      const { tenantId, entradaId } = payload;
      if (!tenantId || !entradaId) return;

      const jaExiste = await this.prisma.contaPagar.count({
        where: { tenantId, entradaId },
      });
      if (jaExiste > 0) return; // idempotência

      const entrada = await this.prisma.entradaMercadoria.findFirst({
        where: { id: entradaId, tenantId },
      });

      const valor = entrada
        ? money(entrada.valorTotal)
        : money((payload.custoUnitario || 0) * (payload.quantidade || 0));
      if (valor <= 0) return;

      await this.create(
        tenantId,
        { id: payload.usuarioId || 'sistema', nome: 'Sistema (Compra)' },
        {
          fornecedorId: entrada?.fornecedorId,
          filialId: payload.filialId,
          entradaId,
          descricao: `Compra — Entrada ${entrada?.numeroNf || entradaId.slice(0, 8)}`,
          valorTotal: valor,
          dataVencimento: this.addDias(new Date(), 30).toISOString(),
          observacoes: 'Gerado automaticamente a partir da entrada de mercadoria (compra).',
        },
      );
    } catch {
      // Falha na geração automática nunca deve derrubar a entrada de estoque.
    }
  }

  // ───────────────────────── Helpers ─────────────────────────

  /** Promove a VENCIDO títulos em aberto/parcial com vencimento no passado. */
  private async marcarVencidas(tenantId: string) {
    await this.prisma.contaPagar.updateMany({
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
