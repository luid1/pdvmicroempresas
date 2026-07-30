import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { PrecificacaoService } from '../precificacao/precificacao.service';
import { TipoMovimentacao } from '@prisma/client';
import { proximoNumero } from '../../common/utils/sequencia.util';
import { money, sumMoney, subMoney, toCents, fromCents } from '../../common/utils/money.util';
import { avaliarTransicaoPedido } from './pedido-status.util';

interface ItemDto {
  produtoId: string;
  descricao?: string;
  quantidade: number;
  unidade?: string;
  precoUnitario?: number; // se ausente/0, resolvido pelo motor de precificação (tabela do cliente)
  descontoTipo?: 'VALOR' | 'PERCENT';
  descontoPercent?: number;
  desconto?: number; // R$
}

interface PedidoDto {
  filialOrigemId: string;
  clienteId: string;
  usuarioId: string;
  tipo?: string;
  dataEmissao?: string;
  dataEntrega?: string;
  periodo?: string;
  regiao?: string;
  volumes?: number;
  formaPagamento?: string;
  condicaoPagamento?: string;
  numeroParcelas?: number;
  tipoFrete?: string;
  valorFrete?: number;
  descontoTotal?: number;
  observacoes?: string;
  observacoesNf?: string;
  enderecoEntregaJson?: any;
  itens?: ItemDto[];
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);
  constructor(
    private prisma: PrismaService,
    private estoque: EstoqueService,
    private precificacao: PrecificacaoService,
  ) {}

  // ── Resolve desconto do item em R$ (dado o preço unitário já resolvido) ──
  private descontoEmReais(item: ItemDto, precoUnitario: number): number {
    const bruto = money(item.quantidade * precoUnitario);
    if (item.descontoTipo === 'PERCENT') {
      return money(bruto * ((item.descontoPercent || 0) / 100));
    }
    return money(item.desconto || 0);
  }

  // ── Calcula linhas + totais do pedido ──
  private async montarItensETotais(tenantId: string, dto: PedidoDto) {
    const itensInput = dto.itens || [];
    if (itensInput.length === 0) {
      return { itensData: [] as any[], subtotal: 0, pesoTotal: 0, valorTotal: 0 };
    }

    const produtoIds = itensInput.map((i) => i.produtoId);
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: produtoIds } },
      include: { unidadeMedida: { select: { sigla: true } } },
    });
    const mapProd = new Map(produtos.map((p) => [p.id, p]));

    // Motor de precificação (Frente M.2): resolve o preço da tabela do cliente para
    // itens sem preço informado (precoUnitario ausente ou 0).
    let precosResolvidos: Record<string, any> = {};
    const precisamPreco = itensInput.filter((i) => !i.precoUnitario || Number(i.precoUnitario) <= 0).map((i) => i.produtoId);
    if (precisamPreco.length > 0) {
      precosResolvidos = await this.precificacao.resolverLote(tenantId, precisamPreco, {
        clienteId: dto.clienteId,
        data: dto.dataEmissao,
      });
    }

    let pesoTotal = 0;
    const itensData = itensInput.map((item) => {
      const prod = mapProd.get(item.produtoId);
      if (!prod) throw new BadRequestException(`Produto ${item.produtoId} não encontrado.`);
      const precoUnitario =
        item.precoUnitario && Number(item.precoUnitario) > 0
          ? money(item.precoUnitario)
          : money(precosResolvidos[item.produtoId]?.preco ?? prod.precoVenda ?? 0);
      const bruto = money(item.quantidade * precoUnitario);
      const descontoR$ = this.descontoEmReais(item, precoUnitario);
      const valorLinha = Math.max(0, subMoney(bruto, descontoR$));
      pesoTotal += Number(prod.pesoBruto || 0) * item.quantidade;
      return {
        produtoId: item.produtoId,
        descricao: item.descricao || prod.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade || prod.unidadeMedida?.sigla || 'UN',
        precoUnitario,
        desconto: descontoR$,
        descontoTipo: item.descontoTipo || 'VALOR',
        descontoPercent: item.descontoPercent || 0,
        valorTotal: valorLinha,
        cfop: prod.cfop,
      };
    });

    const subtotal = sumMoney(itensData.map((i) => i.valorTotal));
    const descontoGeral = money(dto.descontoTotal || 0);
    const frete = money(dto.valorFrete || 0);
    const valorTotal = Math.max(0, fromCents(toCents(subtotal) - toCents(descontoGeral) + toCents(frete)));
    return { itensData, subtotal, pesoTotal, valorTotal };
  }

  // ── Análise de crédito do cliente ──
  // Retorna { bloqueado, motivo } com base em limite de crédito e duplicatas vencidas.
  private async analisarCredito(tenantId: string, clienteId: string, valorPedido: number) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) return { bloqueado: false, motivo: null as string | null };

    const hoje = new Date();
    const abertas = await this.prisma.contaReceber.findMany({
      where: { tenantId, clienteId, status: 'ABERTO' },
      select: { valorOriginal: true, valorPago: true, dataVencimento: true },
    });

    const totalAberto = abertas.reduce((s, c) => s + (Number(c.valorOriginal) - Number(c.valorPago)), 0);
    const vencidas = abertas.filter((c) => c.dataVencimento < hoje);
    const limite = Number(cliente.limiteCredito || 0);

    if (vencidas.length > 0) {
      return { bloqueado: true, motivo: `Cliente possui ${vencidas.length} duplicata(s) vencida(s).` };
    }
    if (limite > 0 && totalAberto + valorPedido > limite) {
      return {
        bloqueado: true,
        motivo: `Limite de crédito excedido (limite R$ ${limite.toFixed(2)}, em aberto + pedido R$ ${(totalAberto + valorPedido).toFixed(2)}).`,
      };
    }
    return { bloqueado: false, motivo: null };
  }

  async create(tenantId: string, dto: PedidoDto) {
    const ultimo = await this.prisma.pedido.findFirst({
      where: { tenantId, filialOrigemId: dto.filialOrigemId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = await proximoNumero(this.prisma, tenantId, `pedido:${dto.filialOrigemId}`, ultimo?.numero || 0);

    const { itensData, subtotal, pesoTotal, valorTotal } = await this.montarItensETotais(tenantId, dto);
    const credito = dto.clienteId
      ? await this.analisarCredito(tenantId, dto.clienteId, valorTotal)
      : { bloqueado: false, motivo: null };

    return this.prisma.pedido.create({
      data: {
        tenantId,
        filialOrigemId: dto.filialOrigemId,
        clienteId: dto.clienteId,
        usuarioId: dto.usuarioId,
        numero,
        tipo: dto.tipo || 'VENDA',
        status: 'RASCUNHO',
        observacoes: dto.observacoes,
        observacoesNf: dto.observacoesNf,
        tipoFrete: dto.tipoFrete,
        formaPagamento: dto.formaPagamento,
        condicaoPagamento: dto.condicaoPagamento,
        numeroParcelas: dto.numeroParcelas || 1,
        periodo: dto.periodo,
        regiao: dto.regiao,
        volumes: dto.volumes || 0,
        pesoTotal,
        enderecoEntregaJson: dto.enderecoEntregaJson,
        dataEmissao: dto.dataEmissao ? new Date(dto.dataEmissao) : undefined,
        dataEntrega: dto.dataEntrega ? new Date(`${String(dto.dataEntrega).split('T')[0]}T12:00:00`) : undefined,
        subtotal,
        descontoTotal: dto.descontoTotal || 0,
        valorFrete: dto.valorFrete || 0,
        valorTotal,
        bloqueioCredito: credito.bloqueado,
        motivoBloqueio: credito.motivo,
        itens: itensData.length > 0 ? { create: itensData } : undefined,
      },
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjCpf: true } },
        itens: true,
        filialOrigem: { select: { id: true, codigo: true, nome: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: PedidoDto) {
    const pedido = await this.findOne(tenantId, id);
    if (pedido.status !== 'RASCUNHO') {
      throw new BadRequestException('Só é possível editar pedidos em rascunho.');
    }

    const { itensData, subtotal, pesoTotal, valorTotal } = await this.montarItensETotais(tenantId, dto);
    const credito = dto.clienteId
      ? await this.analisarCredito(tenantId, dto.clienteId, valorTotal)
      : { bloqueado: false, motivo: null };

    // Recria os itens (estratégia simples para rascunho)
    await this.prisma.itemPedido.deleteMany({ where: { pedidoId: id } });

    return this.prisma.pedido.update({
      where: { id },
      data: {
        clienteId: dto.clienteId,
        observacoes: dto.observacoes,
        observacoesNf: dto.observacoesNf,
        tipoFrete: dto.tipoFrete,
        formaPagamento: dto.formaPagamento,
        condicaoPagamento: dto.condicaoPagamento,
        numeroParcelas: dto.numeroParcelas || 1,
        periodo: dto.periodo,
        regiao: dto.regiao,
        volumes: dto.volumes || 0,
        pesoTotal,
        enderecoEntregaJson: dto.enderecoEntregaJson,
        dataEmissao: dto.dataEmissao ? new Date(dto.dataEmissao) : undefined,
        dataEntrega: dto.dataEntrega ? new Date(`${String(dto.dataEntrega).split('T')[0]}T12:00:00`) : undefined,
        subtotal,
        descontoTotal: dto.descontoTotal || 0,
        valorFrete: dto.valorFrete || 0,
        valorTotal,
        bloqueioCredito: credito.bloqueado,
        motivoBloqueio: credito.motivo,
        itens: itensData.length > 0 ? { create: itensData } : undefined,
      },
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjCpf: true } },
        itens: true,
      },
    });
  }

  async findAll(tenantId: string, filters?: {
    filialId?: string;
    status?: string;
    clienteId?: string;
    dataInicio?: string;
    dataFim?: string;
    search?: string;
  }) {
    const where: any = { tenantId };
    if (filters?.filialId) where.filialOrigemId = filters.filialId;
    if (filters?.status) {
      const lista = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = lista.length > 1 ? { in: lista } : lista[0];
    }
    if (filters?.clienteId) where.clienteId = filters.clienteId;
    if (filters?.search) {
      where.OR = [
        { cliente: { razaoSocial: { contains: filters.search, mode: 'insensitive' } } },
        { cliente: { nomeFantasia: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    if (filters?.dataInicio) {
      where.dataEntrega = {
        gte: new Date(filters.dataInicio),
        ...(filters.dataFim && { lte: new Date(filters.dataFim + 'T23:59:59') }),
      };
    }

    return this.prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        filialOrigem: { select: { id: true, codigo: true, nome: true } },
        _count: { select: { itens: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(tenantId: string, id: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id, tenantId },
      include: {
        cliente: true,
        usuario: { select: { nome: true } },
        itens: {
          include: { produto: { select: { codigo: true, descricao: true, codigoBarras: true, pesoLiquido: true, pesoBruto: true, categoria: true, grupo: true } } },
          orderBy: { id: 'asc' },
        },
        filialOrigem: true,
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return pedido;
  }

  /** Separação/pesagem de um item: grava peso aferido, conferência e corte. */
  async separarItem(
    tenantId: string,
    pedidoId: string,
    itemId: string,
    dto: { pesoAferido?: number; quantidadeSeparada?: number; separado?: boolean; cortado?: boolean },
  ) {
    const pedido = await this.prisma.pedido.findFirst({ where: { id: pedidoId, tenantId }, select: { id: true } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    const item = await this.prisma.itemPedido.findFirst({ where: { id: itemId, pedidoId } });
    if (!item) throw new NotFoundException('Item não encontrado neste pedido.');

    const data: any = {};
    if (dto.pesoAferido !== undefined) data.pesoAferido = dto.pesoAferido;
    if (dto.quantidadeSeparada !== undefined) data.quantidadeSeparada = dto.quantidadeSeparada;
    if (dto.separado !== undefined) data.separado = dto.separado;
    if (dto.cortado !== undefined) data.cortado = dto.cortado;

    await this.prisma.itemPedido.update({ where: { id: itemId }, data });

    // Recalcula o peso total real do pedido (soma dos pesos aferidos dos itens não cortados)
    const itens = await this.prisma.itemPedido.findMany({ where: { pedidoId }, select: { pesoAferido: true, cortado: true } });
    const pesoTotal = itens
      .filter((i) => !i.cortado)
      .reduce((s, i) => s + Number(i.pesoAferido || 0), 0);
    await this.prisma.pedido.update({ where: { id: pedidoId }, data: { pesoTotal } });

    return this.findOne(tenantId, pedidoId);
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const pedido = await this.findOne(tenantId, id);
    const atual = pedido.status as string;

    const avaliacao = avaliarTransicaoPedido(atual, status);
    if (!avaliacao.ok) throw new BadRequestException((avaliacao as { motivo: string }).motivo);
    if ((avaliacao as { idempotente?: boolean }).idempotente) return pedido;

    return this.prisma.pedido.update({
      where: { id },
      data: { status: status as any },
    });
  }

  /**
   * Gera uma REPOSIÇÃO (grátis) a partir de um pedido de origem. Copia cliente e
   * endereço, cria um novo pedido tipo=REPOSICAO já CONFIRMADO (entra no fluxo de
   * separação → carga → entrega). Sem valor (não gera Contas a Receber / NF-e);
   * a saída física sai como comprovante de reposição.
   */
  async criarReposicao(
    tenantId: string,
    usuarioId: string,
    pedidoOrigemId: string,
    dto: { itens?: { produtoId: string; descricao?: string; unidade?: string; quantidade: number }[]; motivo?: string; observacoes?: string },
  ) {
    const origem = await this.findOne(tenantId, pedidoOrigemId);
    if (!Array.isArray(dto?.itens) || dto.itens.length === 0) {
      throw new BadRequestException('Selecione ao menos um item para repor.');
    }

    const ultimo = await this.prisma.pedido.findFirst({
      where: { tenantId, filialOrigemId: origem.filialOrigemId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = await proximoNumero(this.prisma, tenantId, `pedido:${origem.filialOrigemId}`, ultimo?.numero || 0);

    const itensData = dto.itens
      .filter((i) => i.produtoId && Number(i.quantidade) > 0)
      .map((i) => {
        const orig: any = origem.itens.find((it: any) => it.produtoId === i.produtoId);
        return {
          produtoId: i.produtoId,
          descricao: i.descricao || orig?.descricao || orig?.produto?.descricao || 'Item',
          unidade: i.unidade || orig?.unidade || 'UN',
          quantidade: Number(i.quantidade),
          precoUnitario: 0, // reposição é grátis
          valorTotal: 0,
        };
      });
    if (itensData.length === 0) throw new BadRequestException('Nenhum item válido para repor.');

    return this.prisma.pedido.create({
      data: {
        tenantId,
        filialOrigemId: origem.filialOrigemId,
        clienteId: origem.clienteId,
        usuarioId,
        numero,
        tipo: 'REPOSICAO',
        status: 'CONFIRMADO', // já entra no fluxo de separação/carga
        pedidoOrigemId: origem.id,
        motivoReposicao: dto.motivo || null,
        observacoes: dto.observacoes || `Reposição do pedido #${origem.numero}`,
        observacoesNf: `REPOSICAO · Ref. pedido #${origem.numero}`,
        periodo: origem.periodo,
        regiao: origem.regiao,
        enderecoEntregaJson: origem.enderecoEntregaJson as any,
        dataEntrega: new Date(`${new Date().toISOString().split('T')[0]}T12:00:00`),
        subtotal: 0,
        valorTotal: 0,
        itens: { create: itensData },
      },
      include: {
        itens: true,
        cliente: { select: { razaoSocial: true, nomeFantasia: true } },
      },
    });
  }

  /**
   * Conclui uma REPOSIÇÃO: dá baixa no estoque (tipo PERDA) e lança o custo como
   * despesa/perda no financeiro (sem Contas a Receber — reposição é grátis).
   * Marca o pedido como ENTREGUE.
   */
  async concluirReposicao(tenantId: string, usuarioId: string, pedidoId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId },
      include: { itens: { include: { produto: { select: { precoCompra: true, descricao: true } } } } },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    if (pedido.tipo !== 'REPOSICAO') throw new BadRequestException('Este pedido não é uma reposição.');
    if (pedido.status === 'ENTREGUE') throw new BadRequestException('Reposição já foi concluída.');
    if (pedido.status === 'CANCELADO') throw new BadRequestException('Reposição cancelada.');

    // 1. Baixa de estoque como PERDA (permite saldo negativo) + acumula o custo.
    let custoPerda = 0;
    for (const item of pedido.itens) {
      if (!item.produtoId) continue;
      const custo = Number((item as any).produto?.precoCompra || 0) * Number(item.quantidade);
      custoPerda += custo;
      try {
        await this.estoque.baixarFefo(tenantId, {
          filialId: pedido.filialOrigemId,
          produtoId: item.produtoId,
          tipo: TipoMovimentacao.PERDA,
          quantidade: Number(item.quantidade),
          usuarioId,
          observacoes: `Reposição grátis (perda) — pedido #${pedido.numero}`,
        });
      } catch (e: any) {
        this.logger.warn(`Baixa de estoque falhou p/ produto ${item.produtoId}: ${e.message}`);
      }
    }
    custoPerda = Math.round(custoPerda * 100) / 100;

    // 2. Lança a PERDA no financeiro (débito/despesa) — não gera Contas a Receber.
    await this.prisma.lancamentoFinanceiro.create({
      data: {
        tenantId,
        filialId: pedido.filialOrigemId,
        tipo: 'DEBITO',
        valor: custoPerda,
        dataCompetencia: new Date(),
        descricao: `Perda por reposição — pedido #${pedido.numero}`,
        historico: `REPOSICAO;PEDIDO:${pedido.id};ORIGEM:${pedido.pedidoOrigemId || ''}`,
      },
    });

    // 3. Marca a reposição como ENTREGUE (concluída).
    await this.prisma.pedido.update({ where: { id: pedido.id }, data: { status: 'ENTREGUE' } });

    return { ok: true, custoPerda, itens: pedido.itens.length };
  }

  // Aprovar = CONFIRMADO. Bloqueia só por crédito. Estoque pode ficar NEGATIVO
  // (gera aviso de "precisa comprar") em vez de impedir a aprovação.
  async confirmar(tenantId: string, id: string) {
    const pedido = await this.findOne(tenantId, id);

    // Idempotência: só um RASCUNHO pode ser confirmado. Sem isto, confirmar 2×
    // reservava o estoque em dobro.
    if (pedido.status !== 'RASCUNHO') {
      throw new BadRequestException(`Pedido com status ${pedido.status} já foi confirmado (ou não é rascunho).`);
    }

    if (pedido.bloqueioCredito) {
      throw new BadRequestException(
        `Pedido bloqueado por crédito: ${pedido.motivoBloqueio || 'análise pendente'}.`,
      );
    }

    const avisosEstoque: { produtoId: string; descricao: string; disponivelAntes: number; pedido: number; faltam: number }[] = [];

    // Reserva + mudança de status numa ÚNICA transação: se algo falhar no meio,
    // nada é reservado e o status não muda (antes ficava reserva parcial órfã).
    const atualizado = await this.prisma.$transaction(async (tx) => {
      for (const item of pedido.itens) {
        let saldo = await tx.estoqueSaldo.findFirst({
          where: { tenantId, filialId: pedido.filialOrigemId, produtoId: item.produtoId, loteId: null },
        });
        if (!saldo) {
          saldo = await tx.estoqueSaldo.create({
            data: {
              tenantId, filialId: pedido.filialOrigemId, produtoId: item.produtoId,
              quantidade: 0, quantidadeReservada: 0, quantidadeDisponivel: 0,
            },
          });
        }
        const disponivelAntes = Number(saldo.quantidade) - Number(saldo.quantidadeReservada);
        const qtd = Number(item.quantidade);
        const novaReservada = Number(saldo.quantidadeReservada) + qtd;
        const novoDisponivel = Number(saldo.quantidade) - novaReservada; // pode ser < 0

        await tx.estoqueSaldo.update({
          where: { id: saldo.id },
          data: { quantidadeReservada: novaReservada, quantidadeDisponivel: novoDisponivel },
        });

        if (novoDisponivel < 0) {
          avisosEstoque.push({
            produtoId: item.produtoId,
            descricao: item.descricao,
            disponivelAntes,
            pedido: qtd,
            faltam: Math.abs(novoDisponivel),
          });
        }
      }

      return tx.pedido.update({ where: { id }, data: { status: 'CONFIRMADO' as any } });
    });

    return { ...atualizado, avisosEstoque };
  }

  // Cancela o pedido e LIBERA a reserva de estoque se ele estava reservado
  // (confirmado e ainda não faturado). Se já foi faturado, a reserva já saiu no
  // faturamento — não mexe.
  async cancelar(tenantId: string, id: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id, tenantId },
      include: { itens: { select: { produtoId: true, quantidade: true } } },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    if (pedido.status === 'CANCELADO') return pedido;

    const estadosReservados = ['CONFIRMADO', 'EM_SEPARACAO', 'SEPARADO'];
    if (estadosReservados.includes(pedido.status)) {
      await this.estoque.liberarReserva(
        tenantId,
        pedido.filialOrigemId,
        pedido.itens
          .filter((i) => !!i.produtoId)
          .map((i) => ({ produtoId: i.produtoId as string, quantidade: Number(i.quantidade) })),
      );
    }

    return this.updateStatus(tenantId, id, 'CANCELADO');
  }
}
