import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TipoMovimentacao } from '@prisma/client';

export interface MovimentarEstoqueDto {
  filialId: string;
  produtoId: string;
  loteId?: string;
  localizacaoId?: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  custoUnitario?: number;
  pedidoId?: string;
  entradaId?: string;
  nfeId?: string;
  filialDestinoId?: string;
  observacoes?: string;
  usuarioId: string;
  permitirNegativo?: boolean; // permite a saída deixar o saldo negativo (venda "a comprar")
}

@Injectable()
export class EstoqueService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  /**
   * Consulta saldo disponível — usado para validar pedidos e picking
   */
  async getSaldo(tenantId: string, filialId: string, produtoId: string, loteId?: string) {
    return this.prisma.estoqueSaldo.findMany({
      where: { tenantId, filialId, produtoId, ...(loteId && { loteId }) },
      include: {
        produto: { select: { descricao: true, unidadeMedida: { select: { sigla: true } } } },
        lote: { select: { numero: true, dataValidade: true } },
        localizacao: { select: { rua: true, prateleira: true } },
      },
      orderBy: [{ lote: { dataValidade: 'asc' } }], // FEFO — First Expired, First Out
    });
  }

  /**
   * Posição de estoque geral da filial
   */
  async getPosicaoGeral(tenantId: string, filialId: string, filters?: { categoria?: string; alertaValidade?: boolean }) {
    const where: any = { tenantId, filialId };

    const saldos = await this.prisma.estoqueSaldo.findMany({
      where,
      include: {
        produto: {
          select: {
            codigo: true, descricao: true, categoria: true,
            estoqueMinimo: true, diasAlertaValidade: true,
            unidadeMedida: { select: { sigla: true } },
          },
        },
        lote: { select: { numero: true, dataValidade: true } },
        localizacao: { select: { rua: true, bloco: true, prateleira: true } },
      },
    });

    // Alerta de validade para FLV/perecíveis
    const hoje = new Date();
    const resultado = saldos.map((s) => {
      const diasAteVencer = s.lote?.dataValidade
        ? Math.floor((s.lote.dataValidade.getTime() - hoje.getTime()) / 86400000)
        : null;

      return {
        ...s,
        diasAteVencer,
        alertaValidade: diasAteVencer !== null && diasAteVencer <= (s.produto.diasAlertaValidade || 3),
        abaixoMinimo: Number(s.quantidade) <= Number(s.produto.estoqueMinimo),
      };
    });

    if (filters?.alertaValidade) return resultado.filter((r) => r.alertaValidade);
    return resultado;
  }

  /**
   * NÚCLEO DO WMS: Movimenta estoque com controle de saldo, FEFO e auditoria.
   * Toda entrada/saída/transferência passa por aqui.
   */
  async movimentar(tenantId: string, dto: MovimentarEstoqueDto): Promise<void> {
    const tiposEntrada: TipoMovimentacao[] = [
      TipoMovimentacao.ENTRADA_COMPRA,
      TipoMovimentacao.ENTRADA_DEVOLUCAO,
      TipoMovimentacao.TRANSFERENCIA_ENTRADA,
      TipoMovimentacao.AJUSTE_POSITIVO,
    ];
    const isEntrada = tiposEntrada.includes(dto.tipo);

    const isSaida = !isEntrada;

    await this.prisma.$transaction(async (tx) => {
      // 1. Busca ou cria saldo
      const saldoKey = {
        tenantId,
        filialId: dto.filialId,
        produtoId: dto.produtoId,
        loteId: dto.loteId ?? null,
        localizacaoId: dto.localizacaoId ?? null,
      };

      let saldo = await tx.estoqueSaldo.findFirst({ where: saldoKey });

      if (!saldo) {
        if (isSaida && !dto.permitirNegativo) throw new BadRequestException(`Sem saldo para o produto ${dto.produtoId} na filial ${dto.filialId}.`);
        // Saída com permissão de negativo cria o saldo zerado e segue (vai ficar negativo).
        saldo = await tx.estoqueSaldo.create({
          data: { ...saldoKey, quantidade: 0, quantidadeReservada: 0, quantidadeDisponivel: 0, custoMedio: dto.custoUnitario || 0 },
        });
      }

      const qtdAtual = Number(saldo.quantidade);
      if (isSaida && qtdAtual < dto.quantidade && !dto.permitirNegativo) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${qtdAtual}, Solicitado: ${dto.quantidade}`,
        );
      }

      // 2. Calcula novo saldo e custo médio (CMV)
      const novaQtd = isEntrada ? qtdAtual + dto.quantidade : qtdAtual - dto.quantidade;
      let novoCustoMedio = Number(saldo.custoMedio);

      if (isEntrada && dto.custoUnitario && dto.custoUnitario > 0) {
        // Custo médio ponderado
        const totalAtual = qtdAtual * novoCustoMedio;
        const totalNovo = dto.quantidade * dto.custoUnitario;
        novoCustoMedio = (totalAtual + totalNovo) / (qtdAtual + dto.quantidade);
      }

      // 3. Atualiza saldo
      await tx.estoqueSaldo.update({
        where: { id: saldo.id },
        data: {
          quantidade: novaQtd,
          quantidadeDisponivel: Math.max(0, novaQtd - Number(saldo.quantidadeReservada)),
          custoMedio: novoCustoMedio,
        },
      });

      // 4. Registra movimentação (log permanente)
      await tx.movimentacaoEstoque.create({
        data: {
          tenantId,
          filialId: dto.filialId,
          usuarioId: dto.usuarioId,
          produtoId: dto.produtoId,
          loteId: dto.loteId,
          localizacaoId: dto.localizacaoId,
          tipo: dto.tipo,
          quantidade: dto.quantidade,
          custoUnitario: dto.custoUnitario || novoCustoMedio,
          saldoAnterior: qtdAtual,
          saldoFinal: novaQtd,
          pedidoId: dto.pedidoId,
          entradaId: dto.entradaId,
          nfeId: dto.nfeId,
          filialDestinoId: dto.filialDestinoId,
          observacoes: dto.observacoes,
        },
      });
    });

    // 5. Emite evento para listeners (Event-Driven)
    this.events.emit(`estoque.${dto.tipo.toLowerCase()}`, {
      tenantId, ...dto, timestamp: new Date(),
    });
  }

  /**
   * FEFO — lotes de um produto na filial com saldo, ordenados por validade (vence primeiro).
   * Inclui a "linha" sem lote (loteId null) por último.
   */
  async getFefoLotes(tenantId: string, filialId: string, produtoId: string) {
    const saldos = await this.prisma.estoqueSaldo.findMany({
      where: { tenantId, filialId, produtoId, quantidade: { gt: 0 } },
      include: { lote: { select: { numero: true, dataValidade: true } } },
    });
    const hoje = new Date();
    return saldos
      .map((s) => ({
        loteId: s.loteId,
        loteNumero: s.lote?.numero || null,
        dataValidade: s.lote?.dataValidade || null,
        disponivel: Number(s.quantidade) - Number(s.quantidadeReservada || 0),
        quantidade: Number(s.quantidade),
        diasAteVencer: s.lote?.dataValidade ? Math.ceil((s.lote.dataValidade.getTime() - hoje.getTime()) / 86400000) : null,
      }))
      .sort((a, b) => {
        // quem tem validade vem primeiro (mais próxima), depois os sem validade
        if (a.dataValidade && b.dataValidade) return a.dataValidade.getTime() - b.dataValidade.getTime();
        if (a.dataValidade) return -1;
        if (b.dataValidade) return 1;
        return 0;
      });
  }

  /**
   * Baixa uma quantidade seguindo FEFO: consome dos lotes que vencem primeiro.
   * Se o físico não cobrir, a sobra sai do último lote (podendo ficar negativo).
   *
   * `loteId` (rastreabilidade): quando a separação já definiu o lote físico que
   * saiu, ele é consumido PRIMEIRO (até o disponível), e só o excedente cai no
   * FEFO. Assim o lote baixado bate com o que foi separado/impresso na NF-e.
   */
  async baixarFefo(tenantId: string, dto: {
    filialId: string; produtoId: string; quantidade: number; loteId?: string;
    tipo?: TipoMovimentacao; nfeId?: string; pedidoId?: string; usuarioId: string; observacoes?: string;
  }) {
    const tipo = dto.tipo || TipoMovimentacao.SAIDA_VENDA;
    const lotes = await this.getFefoLotes(tenantId, dto.filialId, dto.produtoId);
    let restante = Number(dto.quantidade);
    const alocacoes: { loteId: string | null; quantidade: number }[] = [];

    // Rastreabilidade: prioriza o lote efetivamente separado, se houver saldo nele.
    if (dto.loteId) {
      const preferido = lotes.find((l) => l.loteId === dto.loteId);
      const usar = Math.min(restante, Math.max(0, preferido?.disponivel ?? 0));
      if (usar > 0) { alocacoes.push({ loteId: dto.loteId, quantidade: usar }); restante -= usar; }
    }

    for (const lote of lotes) {
      if (restante <= 0) break;
      if (dto.loteId && lote.loteId === dto.loteId) continue; // já consumido acima
      const usar = Math.min(restante, Math.max(0, lote.disponivel));
      if (usar > 0) { alocacoes.push({ loteId: lote.loteId, quantidade: usar }); restante -= usar; }
    }
    // Sobra sem cobertura: joga no último lote existente (ou sem lote) permitindo negativo
    if (restante > 0.0001) {
      const alvo = lotes[lotes.length - 1];
      alocacoes.push({ loteId: alvo?.loteId ?? null, quantidade: restante });
    }

    for (const a of alocacoes) {
      await this.movimentar(tenantId, {
        filialId: dto.filialId, produtoId: dto.produtoId, tipo,
        quantidade: a.quantidade, loteId: a.loteId ?? undefined,
        nfeId: dto.nfeId, pedidoId: dto.pedidoId, usuarioId: dto.usuarioId,
        permitirNegativo: true, observacoes: dto.observacoes,
      });
    }
    return alocacoes;
  }

  /**
   * Transferência entre filiais — gera saída na origem e entrada no destino
   */
  async transferir(tenantId: string, dto: {
    filialOrigemId: string; filialDestinoId: string;
    produtoId: string; loteId?: string; localizacaoOrigemId?: string;
    quantidade: number; usuarioId: string; observacoes?: string;
  }) {
    // Saída da origem
    await this.movimentar(tenantId, {
      filialId: dto.filialOrigemId,
      filialDestinoId: dto.filialDestinoId,
      produtoId: dto.produtoId,
      loteId: dto.loteId,
      localizacaoId: dto.localizacaoOrigemId,
      tipo: TipoMovimentacao.TRANSFERENCIA_SAIDA,
      quantidade: dto.quantidade,
      usuarioId: dto.usuarioId,
      observacoes: dto.observacoes,
    });

    // Entrada no destino
    await this.movimentar(tenantId, {
      filialId: dto.filialDestinoId,
      produtoId: dto.produtoId,
      loteId: dto.loteId,
      tipo: TipoMovimentacao.TRANSFERENCIA_ENTRADA,
      quantidade: dto.quantidade,
      usuarioId: dto.usuarioId,
      observacoes: dto.observacoes,
    });

    this.events.emit('estoque.transferencia', { tenantId, ...dto, timestamp: new Date() });
  }

  /**
   * Reserva estoque para um pedido (sem baixar — só marca como reservado)
   */
  async reservar(tenantId: string, pedidoId: string, itens: { produtoId: string; loteId?: string; filialId: string; quantidade: number }[]) {
    for (const item of itens) {
      const saldo = await this.prisma.estoqueSaldo.findFirst({
        where: { tenantId, filialId: item.filialId, produtoId: item.produtoId, loteId: item.loteId ?? null },
      });
      if (!saldo || Number(saldo.quantidadeDisponivel) < item.quantidade) {
        throw new BadRequestException(`Saldo insuficiente para produto ${item.produtoId}`);
      }
      await this.prisma.estoqueSaldo.update({
        where: { id: saldo.id },
        data: {
          quantidadeReservada: Number(saldo.quantidadeReservada) + item.quantidade,
          quantidadeDisponivel: Number(saldo.quantidadeDisponivel) - item.quantidade,
        },
      });
    }
  }

  /**
   * LIBERA a reserva feita para um pedido — inverso de `reservar`/`confirmar`.
   *
   * Deve ser chamado quando a reserva deixa de fazer sentido:
   *  - no FATURAMENTO (a mercadoria saiu de fato — o físico já foi baixado);
   *  - no CANCELAMENTO do pedido (a reserva simplesmente some).
   *
   * Sem isso, `quantidadeReservada` só crescia e o "disponível" ficava errado
   * para sempre. Idempotente: nunca deixa a reserva negativa. Opcionalmente
   * recebe uma transação (`tx`) para participar de uma operação atômica maior.
   */
  async liberarReserva(
    tenantId: string,
    filialId: string,
    itens: { produtoId: string; loteId?: string | null; quantidade: number }[],
    tx?: Prisma.TransactionClient,
  ) {
    const db = (tx ?? this.prisma) as any;
    for (const item of itens) {
      if (!item.produtoId || !(Number(item.quantidade) > 0)) continue;
      const saldo = await db.estoqueSaldo.findFirst({
        where: { tenantId, filialId, produtoId: item.produtoId, loteId: item.loteId ?? null },
      });
      if (!saldo) continue;
      const novaReservada = Math.max(0, Number(saldo.quantidadeReservada) - Number(item.quantidade));
      await db.estoqueSaldo.update({
        where: { id: saldo.id },
        data: {
          quantidadeReservada: novaReservada,
          quantidadeDisponivel: Number(saldo.quantidade) - novaReservada,
        },
      });
    }
  }

  /**
   * Produtos a comprar/repor: disponível negativo (vendido sem estoque) ou abaixo do mínimo.
   * Agrega por produto somando todos os saldos (lotes/localizações) da filial.
   */
  async getAComprar(tenantId: string, filialId: string) {
    const saldos = await this.prisma.estoqueSaldo.findMany({
      where: { tenantId, filialId },
      include: {
        produto: {
          select: {
            id: true, codigo: true, descricao: true, estoqueMinimo: true,
            unidadeMedida: { select: { sigla: true } },
          },
        },
      },
    });

    const porProduto = new Map<string, { produtoId: string; codigo: string; descricao: string; unidade: string; quantidade: number; reservada: number; disponivel: number; estoqueMinimo: number }>();
    for (const s of saldos) {
      const k = s.produtoId;
      const cur = porProduto.get(k) || {
        produtoId: k,
        codigo: s.produto.codigo,
        descricao: s.produto.descricao,
        unidade: s.produto.unidadeMedida?.sigla || 'UN',
        quantidade: 0, reservada: 0, disponivel: 0,
        estoqueMinimo: Number(s.produto.estoqueMinimo || 0),
      };
      cur.quantidade += Number(s.quantidade);
      cur.reservada += Number(s.quantidadeReservada);
      cur.disponivel = cur.quantidade - cur.reservada;
      porProduto.set(k, cur);
    }

    return [...porProduto.values()]
      .filter((p) => p.disponivel < 0 || p.disponivel <= p.estoqueMinimo)
      .map((p) => ({
        ...p,
        negativo: p.disponivel < 0,
        sugestaoCompra: Math.max(0, p.estoqueMinimo - p.disponivel),
      }))
      .sort((a, b) => a.disponivel - b.disponivel);
  }

  async getMovimentacoes(tenantId: string, filialId: string, filters: { produtoId?: string; tipo?: TipoMovimentacao; dataInicio?: Date; dataFim?: Date }) {
    return this.prisma.movimentacaoEstoque.findMany({
      where: {
        tenantId, filialId,
        ...(filters.produtoId && { produtoId: filters.produtoId }),
        ...(filters.tipo && { tipo: filters.tipo }),
        ...(filters.dataInicio && { dataMovimento: { gte: filters.dataInicio, ...(filters.dataFim && { lte: filters.dataFim }) } }),
      },
      include: {
        produto: { select: { codigo: true, descricao: true } },
        lote: { select: { numero: true, dataValidade: true } },
        usuario: { select: { nome: true } },
        localizacao: { select: { rua: true, prateleira: true } },
      },
      orderBy: { dataMovimento: 'desc' },
      take: 500,
    });
  }

  /**
   * Resumo de PERDAS e QUEBRAS (avarias) do período, em quantidade e valor (R$).
   * Valor = quantidade × custo unitário da movimentação. Usado no painel gerencial.
   */
  async getResumoPerdas(tenantId: string, filialId: string, dataInicio?: string, dataFim?: string) {
    const movs = await this.prisma.movimentacaoEstoque.findMany({
      where: {
        tenantId, filialId,
        tipo: { in: [TipoMovimentacao.PERDA, TipoMovimentacao.AVARIA] },
        ...(dataInicio && { dataMovimento: { gte: new Date(dataInicio), ...(dataFim && { lte: new Date(dataFim) }) } }),
      },
      include: { produto: { select: { codigo: true, descricao: true } } },
      orderBy: { dataMovimento: 'desc' },
    });

    const perda = { qtd: 0, valor: 0 };
    const quebra = { qtd: 0, valor: 0 };
    const porProduto = new Map<string, { codigo: string; descricao: string; qtd: number; valor: number }>();

    for (const m of movs) {
      const q = Number(m.quantidade);
      const v = q * Number(m.custoUnitario || 0);
      const alvo = m.tipo === TipoMovimentacao.AVARIA ? quebra : perda;
      alvo.qtd += q; alvo.valor += v;
      const key = m.produtoId;
      const cur = porProduto.get(key) || { codigo: m.produto?.codigo || '', descricao: m.produto?.descricao || '', qtd: 0, valor: 0 };
      cur.qtd += q; cur.valor += v; porProduto.set(key, cur);
    }

    return {
      perda, quebra,
      total: { qtd: perda.qtd + quebra.qtd, valor: perda.valor + quebra.valor },
      porProduto: Array.from(porProduto.values()).sort((a, b) => b.valor - a.valor),
    };
  }

  /**
   * Relatório de perecíveis vencendo nos próximos N dias (crítico para FLV)
   */
  async getAlertasValidade(tenantId: string, filialId: string, dias = 5) {
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);

    return this.prisma.estoqueSaldo.findMany({
      where: {
        tenantId, filialId,
        quantidade: { gt: 0 },
        lote: { dataValidade: { lte: limite } },
      },
      include: {
        produto: { select: { codigo: true, descricao: true } },
        lote: { select: { numero: true, dataValidade: true } },
        localizacao: { select: { rua: true, prateleira: true } },
      },
      orderBy: { lote: { dataValidade: 'asc' } },
    });
  }

  /**
   * Lista TODOS os lotes com validade da filial (não só os vencendo). Base da
   * aba de perecíveis para organizar produtos e datas. Traz dias até vencer.
   */
  async getLotes(tenantId: string, filialId: string) {
    const hoje = new Date(new Date().toDateString());
    const saldos = await this.prisma.estoqueSaldo.findMany({
      where: { tenantId, filialId, loteId: { not: null } },
      include: {
        produto: { select: { codigo: true, descricao: true, unidadeMedida: { select: { sigla: true } } } },
        lote: { select: { numero: true, dataValidade: true, dataFabricacao: true } },
        localizacao: { select: { rua: true, prateleira: true } },
      },
      orderBy: [{ lote: { dataValidade: 'asc' } }],
    });

    return saldos.map((s) => ({
      id: s.id,
      produtoId: s.produtoId,
      produto: s.produto,
      loteId: s.loteId,
      lote: s.lote,
      quantidade: Number(s.quantidade),
      localizacao: s.localizacao,
      diasAteVencer: s.lote?.dataValidade
        ? Math.ceil((new Date(s.lote.dataValidade.toDateString()).getTime() - hoje.getTime()) / 86400000)
        : null,
    }));
  }

  /**
   * Cadastra um lote com validade e dá entrada no estoque. Se já existir um lote
   * com o mesmo número para o produto, reaproveita (acumula a quantidade).
   */
  async registrarLote(
    tenantId: string,
    filialId: string,
    usuarioId: string,
    dto: {
      produtoId: string; quantidade: number; dataValidade: string;
      numero?: string; dataFabricacao?: string; custoUnitario?: number; observacoes?: string | null;
    },
  ) {
    const filial = await this.prisma.filial.findFirst({ where: { id: filialId, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');

    const produto = await this.prisma.produto.findFirst({
      where: { id: dto.produtoId, tenantId },
      select: { id: true, descricao: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');

    const qtd = Number(dto.quantidade);
    if (!(qtd > 0)) throw new BadRequestException('Quantidade deve ser maior que zero.');

    const validade = new Date(`${dto.dataValidade}T00:00:00`);
    if (Number.isNaN(validade.getTime())) throw new BadRequestException('Data de validade inválida.');
    const fabricacao = dto.dataFabricacao ? new Date(`${dto.dataFabricacao}T00:00:00`) : null;

    // Número do lote: informado ou derivado da validade (agrupa entradas do mesmo vencimento).
    const numero = (dto.numero || '').trim()
      || `L${dto.dataValidade.replace(/-/g, '')}`;

    // Cria ou reaproveita o lote (unique tenantId+produtoId+numero).
    let lote = await this.prisma.lote.findFirst({
      where: { tenantId, produtoId: dto.produtoId, numero },
    });
    if (!lote) {
      lote = await this.prisma.lote.create({
        data: {
          tenantId,
          produtoId: dto.produtoId,
          numero,
          dataValidade: validade,
          dataFabricacao: fabricacao,
          quantidadeInicial: qtd,
          observacoes: dto.observacoes ?? null,
        },
      });
    } else {
      // Mantém a validade coerente e soma a quantidade inicial cadastrada.
      lote = await this.prisma.lote.update({
        where: { id: lote.id },
        data: {
          dataValidade: validade,
          dataFabricacao: fabricacao ?? lote.dataFabricacao,
          quantidadeInicial: { increment: qtd },
        },
      });
    }

    // Entrada no estoque (usa o núcleo do WMS: atualiza saldo + log + evento).
    await this.movimentar(tenantId, {
      filialId,
      produtoId: dto.produtoId,
      loteId: lote.id,
      tipo: TipoMovimentacao.ENTRADA_COMPRA,
      quantidade: qtd,
      custoUnitario: dto.custoUnitario,
      usuarioId,
      observacoes: dto.observacoes || `Cadastro de validade — lote ${numero}`,
    });

    const saldo = await this.prisma.estoqueSaldo.findFirst({
      where: { tenantId, filialId, produtoId: dto.produtoId, loteId: lote.id },
      select: { quantidade: true },
    });

    return {
      ok: true,
      lote: { id: lote.id, numero: lote.numero, dataValidade: lote.dataValidade, dataFabricacao: lote.dataFabricacao },
      produto: { id: produto.id, descricao: produto.descricao },
      quantidade: qtd,
      saldoLote: saldo ? Number(saldo.quantidade) : qtd,
    };
  }

  /**
   * Análise de estoque físico — dados REAIS por produto no período:
   * saldo inicial, entradas, saídas, ordens de compra pendentes, perdas, quebra,
   * saldo atual e custo. A tela soma com os campos manuais (Chão) e recalcula.
   */
  async getAnaliseEstoque(tenantId: string, filialId: string, dataIni?: string, dataFim?: string) {
    const ini = dataIni ? new Date(`${dataIni}T00:00:00`) : null;
    const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : null;

    const [produtos, movs, ocItens] = await Promise.all([
      this.prisma.produto.findMany({
        where: { tenantId, ativo: true },
        select: {
          id: true, codigo: true, descricao: true, categoria: true, grupo: true, precoCusto: true,
          unidadeMedida: { select: { sigla: true } },
          estoques: { where: { filialId }, select: { quantidade: true, custoMedio: true } },
        },
        orderBy: { descricao: 'asc' },
      }),
      this.prisma.movimentacaoEstoque.findMany({
        where: { tenantId, filialId, ...(ini && { dataMovimento: { gte: ini, ...(fim && { lte: fim }) } }) },
        select: { produtoId: true, tipo: true, quantidade: true },
      }),
      this.prisma.itemOrdemCompra.findMany({
        where: { produtoId: { not: null }, ordem: { tenantId, status: { in: ['PENDENTE', 'APROVADA', 'PARCIAL'] } } },
        select: { produtoId: true, quantidade: true },
      }),
    ]);

    const ENTRADAS = ['ENTRADA_COMPRA', 'ENTRADA_DEVOLUCAO', 'AJUSTE_POSITIVO', 'TRANSFERENCIA_ENTRADA'];
    const SAIDAS = ['SAIDA_VENDA', 'SAIDA_DEVOLUCAO_FORNECEDOR', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA_SAIDA', 'PICKING'];

    const agg = new Map<string, { entradas: number; saidas: number; perdas: number; quebra: number; net: number }>();
    const get = (id: string) => { if (!agg.has(id)) agg.set(id, { entradas: 0, saidas: 0, perdas: 0, quebra: 0, net: 0 }); return agg.get(id)!; };
    for (const m of movs) {
      const q = Number(m.quantidade); const g = get(m.produtoId);
      if (ENTRADAS.includes(m.tipo)) { g.entradas += q; g.net += q; }
      else if (m.tipo === 'PERDA') { g.perdas += q; g.net -= q; }
      else if (m.tipo === 'AVARIA') { g.quebra += q; g.net -= q; }
      else if (SAIDAS.includes(m.tipo)) { g.saidas += q; g.net -= q; }
    }
    const ocByProd = new Map<string, number>();
    for (const it of ocItens) if (it.produtoId) ocByProd.set(it.produtoId, (ocByProd.get(it.produtoId) || 0) + Number(it.quantidade));

    return produtos.map((p) => {
      const g = agg.get(p.id) || { entradas: 0, saidas: 0, perdas: 0, quebra: 0, net: 0 };
      const saldoAtual = p.estoques.reduce((s, e) => s + Number(e.quantidade), 0);
      const custo = Number(p.estoques.find((e) => Number(e.custoMedio) > 0)?.custoMedio ?? p.precoCusto ?? 0);
      return {
        id: p.id, codigo: p.codigo, descricao: p.descricao,
        familia: p.categoria || '-', grupo: p.grupo || '-',
        undEstoque: p.unidadeMedida?.sigla || 'UN',
        saldoInicial: saldoAtual - g.net,       // saldo no início do período
        entradas: g.entradas,
        saidas: -g.saidas,                      // negativo (para exibição)
        ordensCompra: ocByProd.get(p.id) || 0,
        perdasReal: g.perdas,
        quebraReal: g.quebra,
        saldoAtual,
        precoCusto: custo,
      };
    });
  }
}
