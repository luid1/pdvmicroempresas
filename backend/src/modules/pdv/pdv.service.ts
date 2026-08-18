import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoMovimento, OrigemMovimento, TipoMovimentacao } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { TesourariaService } from '../tesouraria/tesouraria.service';
import { SessaoCaixaService } from './sessao-caixa.service';
import { NfceService } from '../nfe/nfce.service';
import { proximoNumero } from '../../common/utils/sequencia.util';
import { RegistrarVendaDto } from './dto/pdv.dto';

interface UsuarioCtx {
  id: string;
  nome?: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Reduz uma forma detalhada (CARTAO_TEF, PIX_POS, ...) à categoria de dinheiro. */
function categoriaPagamento(forma: string): 'DINHEIRO' | 'CARTAO' | 'PIX' {
  const f = (forma || '').toUpperCase();
  if (f.startsWith('DINHEIRO')) return 'DINHEIRO';
  if (f.startsWith('PIX')) return 'PIX';
  return 'CARTAO';
}

@Injectable()
export class PdvService {
  constructor(
    private prisma: PrismaService,
    private estoque: EstoqueService,
    private tesouraria: TesourariaService,
    private sessaoCaixa: SessaoCaixaService,
    private nfce: NfceService,
  ) {}

  /**
   * Busca um produto pelo código de barras (EAN) OU código interno, já com o
   * saldo disponível na filial. Usado no "bipe" do caixa.
   */
  async buscarProduto(tenantId: string, codigo: string, filialId?: string) {
    const cod = (codigo || '').trim();
    if (!cod) throw new BadRequestException('Informe um código.');

    const produto = await this.prisma.produto.findFirst({
      where: {
        tenantId,
        ativo: true,
        OR: [{ codigoBarras: cod }, { codigo: cod }],
      },
      include: {
        unidadeMedida: { select: { sigla: true } },
        estoques: filialId
          ? { where: { filialId }, select: { quantidade: true, quantidadeReservada: true } }
          : { select: { quantidade: true, quantidadeReservada: true } },
      },
    });

    if (!produto) throw new NotFoundException(`Produto ${cod} não encontrado.`);

    const disponivel = produto.estoques.reduce(
      (s, e) => s + (Number(e.quantidade) - Number(e.quantidadeReservada)),
      0,
    );

    return {
      id: produto.id,
      codigo: produto.codigo,
      codigoBarras: produto.codigoBarras,
      descricao: produto.descricao,
      // Produto por peso é vendido em KG (preço por quilo); os demais usam a
      // sigla cadastrada. O caixa usa `vendidoPorPeso` p/ pedir o peso na balança.
      unidade: produto.vendidoPorPeso ? 'KG' : (produto.unidadeMedida?.sigla || 'UN'),
      vendidoPorPeso: produto.vendidoPorPeso,
      precoVenda: Number(produto.precoVenda),
      estoqueDisponivel: disponivel,
    };
  }

  /**
   * Autocomplete do caixa: busca produtos por parte da descrição OU início do
   * código/código de barras. Retorna uma lista curta já com preço e estoque,
   * no mesmo formato de `buscarProduto`. Usado quando o operador digita o nome.
   */
  async buscarProdutos(tenantId: string, termo: string, filialId?: string) {
    const t = (termo || '').trim();
    if (t.length < 2) return [];

    const produtos = await this.prisma.produto.findMany({
      where: {
        tenantId,
        ativo: true,
        OR: [
          { descricao: { contains: t, mode: 'insensitive' } },
          { codigo: { startsWith: t } },
          { codigoBarras: { startsWith: t } },
        ],
      },
      include: {
        unidadeMedida: { select: { sigla: true } },
        estoques: filialId
          ? { where: { filialId }, select: { quantidade: true, quantidadeReservada: true } }
          : { select: { quantidade: true, quantidadeReservada: true } },
      },
      orderBy: { descricao: 'asc' },
      take: 12,
    });

    return produtos.map((produto) => {
      const disponivel = produto.estoques.reduce(
        (s, e) => s + (Number(e.quantidade) - Number(e.quantidadeReservada)),
        0,
      );
      return {
        id: produto.id,
        codigo: produto.codigo,
        codigoBarras: produto.codigoBarras,
        descricao: produto.descricao,
        unidade: produto.vendidoPorPeso ? 'KG' : (produto.unidadeMedida?.sigla || 'UN'),
        vendidoPorPeso: produto.vendidoPorPeso,
        precoVenda: Number(produto.precoVenda),
        estoqueDisponivel: disponivel,
      };
    });
  }

  /**
   * Registra uma venda de frente de caixa:
   *  1. Cria um Pedido (VENDA / FATURADO) com seus itens;
   *  2. Baixa o estoque (FEFO) de cada item;
   *  3. Lança a entrada no caixa (dinheiro/cartão/pix);
   * Retorna o "cupom" para impressão/exibição.
   */
  async registrarVenda(tenantId: string, usuario: UsuarioCtx, dto: RegistrarVendaDto) {
    if (!dto.itens?.length) throw new BadRequestException('A venda precisa de ao menos um item.');

    const filial = await this.prisma.filial.findFirst({ where: { id: dto.filialId, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');

    // Exige um caixa aberto — toda venda pertence a uma sessão/turno.
    const sessao = await this.sessaoCaixa.exigirSessaoAberta(tenantId, usuario.id, dto.filialId);

    // Valida os produtos e monta os itens já com o valor calculado.
    const itens = dto.itens.map((i) => {
      const quantidade = Number(i.quantidade);
      const precoUnit = round2(Number(i.precoUnit));
      if (!(quantidade > 0)) throw new BadRequestException('Quantidade inválida em um dos itens.');
      if (!(precoUnit >= 0)) throw new BadRequestException('Preço inválido em um dos itens.');
      return {
        produtoId: i.produtoId,
        descricao: i.descricao || '',
        unidade: i.unidade || '',
        quantidade,
        precoUnit,
        valorTotal: round2(precoUnit * quantidade),
      };
    });

    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: itens.map((i) => i.produtoId) } },
      select: {
        id: true,
        descricao: true,
        vendidoPorPeso: true,
        unidadeMedida: { select: { sigla: true } },
      },
    });
    const mapProduto = new Map(produtos.map((p) => [p.id, p]));
    for (const it of itens) {
      const p = mapProduto.get(it.produtoId);
      if (!p) throw new NotFoundException(`Produto ${it.produtoId} não encontrado.`);
      if (!it.descricao) it.descricao = p.descricao;
      // Unidade canônica do produto manda no cupom: produto por peso = KG,
      // senão a sigla cadastrada (ex.: UN, PCT, CX). Só cai no 'UN' se faltar tudo.
      if (!it.unidade) it.unidade = p.vendidoPorPeso ? 'KG' : (p.unidadeMedida?.sigla || 'UN');
    }

    const subtotal = round2(itens.reduce((s, i) => s + i.valorTotal, 0));

    // Desconto sobre o total da venda (já resolvido em R$ pelo caixa).
    const desconto = round2(Math.max(0, Number(dto.desconto || 0)));
    if (desconto > subtotal + 0.005) {
      throw new BadRequestException('Desconto não pode ser maior que o total da venda.');
    }
    const limiteMax = Number(process.env.PDV_DESCONTO_MAX_PERCENT ?? 100);
    const descontoPct = subtotal > 0 ? (desconto / subtotal) * 100 : 0;
    if (descontoPct > limiteMax + 0.001) {
      throw new BadRequestException(
        `Desconto de ${descontoPct.toFixed(1)}% excede o limite permitido (${limiteMax}%). Chame o gerente.`,
      );
    }
    const valorTotal = round2(subtotal - desconto);

    // 0) Normaliza os pagamentos (aceita forma única OU pagamento dividido).
    const pagamentosRaw =
      dto.pagamentos && dto.pagamentos.length
        ? dto.pagamentos
        : [{
            forma: dto.formaPagamento || 'DINHEIRO',
            valor: valorTotal,
            valorRecebido: dto.valorRecebido,
          }];

    const pagamentos = pagamentosRaw.map((p) => {
      const valor = round2(Number(p.valor));
      if (!(valor > 0)) throw new BadRequestException('Valor de pagamento inválido.');
      const categoria = categoriaPagamento(p.forma);
      const info = [p.bandeira, p.nsu && `NSU ${p.nsu}`, p.autorizacao && `AUT ${p.autorizacao}`]
        .filter(Boolean)
        .join(' ');
      const recebido = p.valorRecebido != null ? round2(Number(p.valorRecebido)) : null;
      const troco = categoria === 'DINHEIRO' && recebido != null ? round2(Math.max(0, recebido - valor)) : 0;
      return { forma: p.forma, categoria, valor, info, valorRecebido: recebido, troco };
    });

    const somaPagamentos = round2(pagamentos.reduce((s, p) => s + p.valor, 0));
    if (Math.abs(somaPagamentos - valorTotal) > 0.01) {
      throw new BadRequestException(
        `Soma dos pagamentos (${somaPagamentos}) difere do total da venda (${valorTotal}).`,
      );
    }
    const trocoTotal = round2(pagamentos.reduce((s, p) => s + p.troco, 0));
    const formaResumo =
      pagamentos.length === 1
        ? pagamentos[0].forma
        : [...new Set(pagamentos.map((p) => p.categoria))].join('+');

    // 1) Cria o pedido + itens (numeração atômica por filial).
    const numero = await proximoNumero(this.prisma, tenantId, `pedido:${dto.filialId}`);
    const pedido = await this.prisma.pedido.create({
      data: {
        tenantId,
        filialOrigemId: dto.filialId,
        usuarioId: usuario.id,
        numero,
        tipo: 'VENDA',
        status: 'FATURADO',
        formaPagamento: formaResumo,
        condicaoPagamento: 'A_VISTA',
        subtotal,
        descontoTotal: desconto,
        valorTotal,
        dataEmissao: new Date(),
        observacoes: 'Venda PDV (frente de caixa)',
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            descricao: i.descricao,
            quantidade: i.quantidade,
            unidade: i.unidade,
            precoUnitario: i.precoUnit,
            valorTotal: i.valorTotal,
          })),
        },
      },
    });

    // 2) Baixa de estoque (FEFO, permite negativo — venda não pode travar).
    for (const it of itens) {
      await this.estoque.baixarFefo(tenantId, {
        filialId: dto.filialId,
        produtoId: it.produtoId,
        quantidade: it.quantidade,
        pedidoId: pedido.id,
        usuarioId: usuario.id,
        observacoes: `Venda PDV #${numero}`,
      });
    }

    // 3) Entrada no caixa (na conta da sessão aberta).
    await this.prisma.$transaction((tx) =>
      this.tesouraria.registrarMovimentoTx(tx, {
        tenantId,
        contaId: sessao.contaId,
        filialId: dto.filialId,
        tipo: TipoMovimento.ENTRADA,
        valor: valorTotal,
        descricao: `Venda PDV #${numero} · ${formaResumo}`,
        origem: OrigemMovimento.AVULSO,
        usuario: { id: usuario.id, nome: usuario.nome },
      }),
    );

    // 4) Lança a venda dentro da sessão/turno (para o relatório X/Z).
    await this.sessaoCaixa.registrarVendaNaSessao(tenantId, sessao.id, {
      pagamentos: pagamentos.map((p) => ({
        categoria: p.categoria,
        formaDetalhada: p.forma,
        valor: p.valor,
        info: p.info || undefined,
      })),
      pedidoId: pedido.id,
      numero,
      usuario,
    });

    // 5) NFC-e (modelo 65) — CAMADA PLUGÁVEL. Liga sozinha quando a Central Fiscal
    //    da filial está ativa (turnkey) OU quando NFCE_MODO está setado no ambiente.
    //    A venda já foi registrada (estoque + caixa); a emissão fiscal é um extra
    //    que NUNCA pode derrubar a venda. Falha vira apenas um aviso no cupom.
    let fiscal: any = null;
    if (await this.nfce.habilitadoParaFilial(tenantId, dto.filialId)) {
      try {
        const r = await this.nfce.emitirDePedido(tenantId, pedido.id, dto.filialId, usuario.id);
        fiscal = {
          modelo: '65',
          status: r.status,
          chaveAcesso: r.chaveAcesso,
          qrCode: r.qrCode,
          urlConsulta: r.urlConsulta,
          danfeUrl: r.danfeUrl,
          simulacao: r.simulacao,
        };
      } catch (e: any) {
        fiscal = { modelo: '65', status: 'FALHOU', erro: e?.message || 'erro ao emitir NFC-e' };
      }
    }

    return {
      pedidoId: pedido.id,
      fiscal,
      sessaoId: sessao.id,
      numero,
      dataEmissao: pedido.dataEmissao,
      formaPagamento: formaResumo,
      subtotal,
      desconto,
      valorTotal,
      valorRecebido: pagamentos.reduce((s, p) => s + (p.valorRecebido ?? 0), 0) || null,
      troco: trocoTotal,
      pagamentos: pagamentos.map((p) => ({
        forma: p.forma,
        categoria: p.categoria,
        valor: p.valor,
        troco: p.troco,
        info: p.info || null,
      })),
      itens: itens.map((i) => ({
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade,
        precoUnit: i.precoUnit,
        valorTotal: i.valorTotal,
      })),
    };
  }

  /** Últimas vendas de frente de caixa da filial (para reimpressão/estorno). */
  async vendasRecentes(tenantId: string, filialId?: string, limite = 20) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { tenantId, tipo: 'VENDA', ...(filialId && { filialOrigemId: filialId }) },
      orderBy: { dataEmissao: 'desc' },
      take: Math.min(Number(limite) || 20, 100),
      select: {
        id: true,
        numero: true,
        status: true,
        valorTotal: true,
        formaPagamento: true,
        dataEmissao: true,
        usuario: { select: { nome: true } },
      },
    });
    return pedidos.map((p) => ({
      pedidoId: p.id,
      numero: p.numero,
      status: p.status,
      valorTotal: Number(p.valorTotal),
      formaPagamento: p.formaPagamento,
      dataEmissao: p.dataEmissao,
      operador: p.usuario?.nome || null,
      estornada: p.status === 'CANCELADO',
    }));
  }

  /** Reconstrói os dados do cupom de uma venda já registrada (reimpressão). */
  async reimprimirCupom(tenantId: string, pedidoId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId, tipo: 'VENDA' },
      include: {
        itens: true,
        filialOrigem: { select: { nome: true } },
        usuario: { select: { nome: true } },
      },
    });
    if (!pedido) throw new NotFoundException('Venda não encontrada.');

    const movs = await this.prisma.movimentoSessao.findMany({
      where: { tenantId, pedidoId, tipo: 'VENDA' },
    });

    return {
      pedidoId: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      loja: pedido.filialOrigem?.nome || 'Loja',
      operador: pedido.usuario?.nome || 'Operador',
      dataEmissao: pedido.dataEmissao,
      subtotal: Number(pedido.subtotal),
      desconto: Number(pedido.descontoTotal),
      valorTotal: Number(pedido.valorTotal),
      troco: 0,
      itens: pedido.itens.map((i) => ({
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        unidade: i.unidade,
        precoUnit: Number(i.precoUnitario),
        valorTotal: Number(i.valorTotal),
      })),
      pagamentos: movs.map((m) => ({
        forma: m.formaPagamento || 'DINHEIRO',
        valor: Number(m.valor),
        troco: 0,
      })),
    };
  }

  /**
   * Estorna uma venda de frente de caixa: devolve o estoque, reverte a entrada
   * no caixa, ajusta os totais da sessão e marca o pedido como CANCELADO.
   * Só é permitido enquanto a sessão de caixa da venda estiver ABERTA — depois
   * disso a devolução deve passar pelo módulo financeiro/fiscal.
   */
  async estornarVenda(tenantId: string, usuario: UsuarioCtx, pedidoId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId, tipo: 'VENDA' },
    });
    if (!pedido) throw new NotFoundException('Venda não encontrada.');
    if (pedido.status === 'CANCELADO') throw new BadRequestException('Esta venda já foi estornada.');
    if (pedido.status !== 'FATURADO') {
      throw new BadRequestException('A venda não está em um estado que permita estorno.');
    }

    const movs = await this.prisma.movimentoSessao.findMany({
      where: { tenantId, pedidoId, tipo: 'VENDA' },
    });
    const sessaoId = movs[0]?.sessaoId;
    const sessao = sessaoId
      ? await this.prisma.sessaoCaixa.findFirst({ where: { id: sessaoId, tenantId } })
      : null;
    if (!sessao || sessao.status !== 'ABERTA') {
      throw new BadRequestException(
        'A sessão de caixa desta venda já foi fechada. Faça a devolução pelo módulo financeiro/fiscal.',
      );
    }

    // 1) Devolve o estoque no mesmo lote de cada saída da venda.
    const saidas = await this.prisma.movimentacaoEstoque.findMany({
      where: { tenantId, pedidoId, tipo: TipoMovimentacao.SAIDA_VENDA },
    });
    for (const s of saidas) {
      await this.estoque.movimentar(tenantId, {
        filialId: s.filialId,
        produtoId: s.produtoId,
        loteId: s.loteId ?? undefined,
        tipo: TipoMovimentacao.ENTRADA_DEVOLUCAO,
        quantidade: Number(s.quantidade),
        usuarioId: usuario.id,
        pedidoId: pedido.id,
        permitirNegativo: true,
        observacoes: `Estorno venda PDV #${pedido.numero}`,
      });
    }

    // 2) Reverte a entrada no caixa (saída do valor total da venda).
    await this.prisma.$transaction((tx) =>
      this.tesouraria.registrarMovimentoTx(tx, {
        tenantId,
        contaId: sessao.contaId,
        filialId: pedido.filialOrigemId,
        tipo: TipoMovimento.SAIDA,
        valor: Number(pedido.valorTotal),
        descricao: `Estorno venda PDV #${pedido.numero}`,
        origem: OrigemMovimento.AVULSO,
        usuario: { id: usuario.id, nome: usuario.nome },
      }),
    );

    // 3) Ajusta os totais da sessão (por categoria) e o contador de vendas.
    const dec: Record<string, number> = { totalDinheiro: 0, totalCartao: 0, totalPix: 0 };
    for (const m of movs) {
      const cat = categoriaPagamento(m.formaPagamento || 'DINHEIRO');
      const campo = cat === 'DINHEIRO' ? 'totalDinheiro' : cat === 'CARTAO' ? 'totalCartao' : 'totalPix';
      dec[campo] += Number(m.valor);
    }
    await this.prisma.sessaoCaixa.update({
      where: { id: sessao.id },
      data: {
        totalDinheiro: { decrement: round2(dec.totalDinheiro) },
        totalCartao: { decrement: round2(dec.totalCartao) },
        totalPix: { decrement: round2(dec.totalPix) },
        qtdVendas: { decrement: 1 },
      },
    });

    // 4) Marca o pedido como CANCELADO.
    await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        status: 'CANCELADO',
        observacoes: `${pedido.observacoes || ''} · ESTORNADO por ${usuario.nome || usuario.id}`.trim(),
      },
    });

    // 5) Trilha de auditoria.
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        usuarioId: usuario.id,
        modulo: 'PEDIDOS',
        acao: 'CANCELAR',
        entidade: 'Pedido',
        entidadeId: pedido.id,
        dadosAntes: { status: 'FATURADO', valorTotal: Number(pedido.valorTotal) },
        dadosDepois: { status: 'CANCELADO', motivo: 'Estorno PDV' },
      },
    });

    return { ok: true, pedidoId: pedido.id, numero: pedido.numero, estornadoEm: new Date() };
  }
}
