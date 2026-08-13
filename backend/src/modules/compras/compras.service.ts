import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { StatusOrdemCompra, TipoMovimentacao } from '@prisma/client';
import { proximoNumero } from '../../common/utils/sequencia.util';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Compras & Suprimentos — Ordem de Compra (OC).
 * Relação 1:N entre OrdemCompra e ItemOrdemCompra. O recebimento integra com o
 * estoque (entrada) e com o financeiro (contas a pagar).
 */
@Injectable()
export class ComprasService {
  constructor(private prisma: PrismaService, private estoque: EstoqueService) {}

  // ── Helpers ──
  /** Normaliza os itens do DTO e calcula subtotal/total. */
  private prepararItens(itens: any[]) {
    if (!Array.isArray(itens) || itens.length === 0) throw new BadRequestException('Informe ao menos um item.');
    const preparados = itens.map((i) => {
      const quantidade = Number(i.quantidade) || 0;
      const precoUnitario = Number(i.precoUnitario) || 0;
      if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');
      if (precoUnitario < 0) throw new BadRequestException('Preço unitário não pode ser negativo.');
      return {
        produtoId: i.produtoId || null,
        descricao: (i.descricao || '').trim(),
        unidade: i.unidade || 'KG',
        quantidade,
        precoUnitario,
        subtotal: r2(quantidade * precoUnitario),
      };
    });
    const valorTotal = r2(preparados.reduce((s, i) => s + i.subtotal, 0));
    return { preparados, valorTotal };
  }

  // ── READ ──
  findAll(tenantId: string, filtros?: { status?: string; fornecedorId?: string; search?: string }) {
    return this.prisma.ordemCompra.findMany({
      where: {
        tenantId,
        ...(filtros?.status && { status: filtros.status as StatusOrdemCompra }),
        ...(filtros?.fornecedorId && { fornecedorId: filtros.fornecedorId }),
        ...(filtros?.search && {
          OR: [
            { fornecedor: { razaoSocial: { contains: filtros.search, mode: 'insensitive' as any } } },
            ...(Number.isNaN(Number(filtros.search)) ? [] : [{ numero: Number(filtros.search) }]),
          ],
        }),
      },
      include: { fornecedor: { select: { razaoSocial: true, nomeFantasia: true } }, _count: { select: { itens: true } } },
      orderBy: { numero: 'desc' },
      take: 300,
    });
  }

  async findOne(tenantId: string, id: string) {
    const oc = await this.prisma.ordemCompra.findFirst({
      where: { id, tenantId },
      include: {
        fornecedor: true,
        itens: { include: { produto: { select: { codigo: true, descricao: true } } } },
      },
    });
    if (!oc) throw new NotFoundException('Ordem de compra não encontrada.');
    return oc;
  }

  /**
   * Histórico de compras de um produto: as últimas OCs que incluíram esse produto,
   * com fornecedor, data, quantidade, preço e status. Alimenta o painel "quem pediu
   * das últimas vezes" no App do Comprador.
   */
  async historicoProduto(tenantId: string, produtoId: string) {
    const itens = await this.prisma.itemOrdemCompra.findMany({
      where: { produtoId, ordem: { tenantId } },
      include: {
        ordem: {
          select: {
            id: true,
            numero: true,
            status: true,
            dataEmissao: true,
            fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
          },
        },
      },
      orderBy: { ordem: { dataEmissao: 'desc' } },
      take: 12,
    });

    return itens.map((it) => ({
      ordemId: it.ordem.id,
      numero: it.ordem.numero,
      status: it.ordem.status,
      data: it.ordem.dataEmissao,
      fornecedor: it.ordem.fornecedor?.nomeFantasia || it.ordem.fornecedor?.razaoSocial || 'Fornecedor',
      quantidade: Number(it.quantidade),
      unidade: it.unidade,
      precoUnitario: Number(it.precoUnitario),
      subtotal: Number(it.subtotal),
    }));
  }

  // ── CREATE ──
  async create(tenantId: string, dto: any) {
    if (!dto.fornecedorId) throw new BadRequestException('Selecione o fornecedor.');
    const { preparados, valorTotal } = this.prepararItens(dto.itens);

    const ultimo = await this.prisma.ordemCompra.findFirst({ where: { tenantId }, orderBy: { numero: 'desc' } });
    const numero = await proximoNumero(this.prisma, tenantId, 'oc', ultimo?.numero || 0);

    return this.prisma.ordemCompra.create({
      data: {
        tenantId,
        filialId: dto.filialId || null,
        fornecedorId: dto.fornecedorId,
        numero,
        status: StatusOrdemCompra.PENDENTE,
        condicaoPagamento: dto.condicaoPagamento || null,
        dataEntregaPrevista: dto.dataEntregaPrevista ? new Date(dto.dataEntregaPrevista) : null,
        observacoes: dto.observacoes || null,
        valorTotal,
        itens: { create: preparados },
      },
      include: { itens: true },
    });
  }

  // ── UPDATE ──
  async update(tenantId: string, id: string, dto: any) {
    const oc = await this.prisma.ordemCompra.findFirst({ where: { id, tenantId } });
    if (!oc) throw new NotFoundException('Ordem de compra não encontrada.');
    if (oc.status === 'ENTREGUE' || oc.status === 'CANCELADA') {
      throw new BadRequestException(`OC ${oc.status} não pode ser editada.`);
    }
    const { preparados, valorTotal } = this.prepararItens(dto.itens);

    // recria os itens (1:N) e atualiza o cabeçalho
    await this.prisma.itemOrdemCompra.deleteMany({ where: { ordemId: id } });
    return this.prisma.ordemCompra.update({
      where: { id },
      data: {
        fornecedorId: dto.fornecedorId ?? oc.fornecedorId,
        filialId: dto.filialId ?? oc.filialId,
        condicaoPagamento: dto.condicaoPagamento ?? oc.condicaoPagamento,
        dataEntregaPrevista: dto.dataEntregaPrevista ? new Date(dto.dataEntregaPrevista) : oc.dataEntregaPrevista,
        observacoes: dto.observacoes ?? oc.observacoes,
        valorTotal,
        itens: { create: preparados },
      },
      include: { itens: true },
    });
  }

  // ── DELETE ──
  async remove(tenantId: string, id: string) {
    const oc = await this.prisma.ordemCompra.findFirst({ where: { id, tenantId } });
    if (!oc) throw new NotFoundException('Ordem de compra não encontrada.');
    if (oc.status === 'ENTREGUE') throw new BadRequestException('OC entregue não pode ser excluída (já movimentou estoque).');
    await this.prisma.ordemCompra.delete({ where: { id } }); // itens caem por cascade
    return { ok: true };
  }

  // ── STATUS ──
  async mudarStatus(tenantId: string, id: string, status: StatusOrdemCompra, usuarioId: string) {
    const oc = await this.prisma.ordemCompra.findFirst({ where: { id, tenantId } });
    if (!oc) throw new NotFoundException('Ordem de compra não encontrada.');
    // Entrega passa pelo fluxo de recebimento (mexe no estoque)
    if (status === 'ENTREGUE') return this.receber(tenantId, id, usuarioId);
    return this.prisma.ordemCompra.update({ where: { id }, data: { status } });
  }

  /**
   * Recebe a OC (total ou parcial): gera uma `EntradaMercadoria` com os itens da
   * remessa, dá entrada no estoque de cada item com produto, gera o Contas a Pagar
   * (vinculado à entrada) e ajusta o status para PARCIAL ou ENTREGUE.
   *
   * `dto.itens` opcional: quando informado, recebe só as quantidades declaradas
   * (respeitando o saldo pendente de cada item); quando omitido, recebe todo o
   * saldo pendente — mantendo o comportamento antigo de "recebimento total".
   */
  async receber(tenantId: string, id: string, usuarioId: string, dto?: { itens?: any[] }) {
    const oc = await this.prisma.ordemCompra.findFirst({ where: { id, tenantId }, include: { itens: true } });
    if (!oc) throw new NotFoundException('Ordem de compra não encontrada.');
    if (oc.status === 'ENTREGUE') throw new BadRequestException('OC já foi entregue por completo.');
    if (oc.status === 'CANCELADA') throw new BadRequestException('OC cancelada não pode ser recebida.');
    if (!oc.filialId) throw new BadRequestException('Defina a filial de destino antes de receber.');

    // Quanto ainda falta receber de cada item (quantidade pedida − já recebida).
    const pendentePorItem = new Map<string, number>();
    for (const item of oc.itens) {
      pendentePorItem.set(item.id, r2(Number(item.quantidade) - Number(item.quantidadeRecebida)));
    }

    // Monta a remessa: do DTO (parcial) ou o saldo pendente inteiro (total).
    const informado = Array.isArray(dto?.itens) && dto!.itens!.length > 0;
    type Remessa = { item: typeof oc.itens[number]; qtd: number; loteNumero?: string | null; dataValidade?: string | null };
    const remessa: Remessa[] = [];

    if (informado) {
      for (const linha of dto!.itens!) {
        const item = oc.itens.find((i) => i.id === linha.itemId);
        if (!item) throw new BadRequestException(`Item ${linha.itemId} não pertence a esta OC.`);
        const qtd = Number(linha.quantidadeRecebida) || 0;
        const pendente = pendentePorItem.get(item.id) ?? 0;
        if (qtd <= 0) throw new BadRequestException('Quantidade recebida deve ser maior que zero.');
        if (qtd > pendente + 1e-6) {
          throw new BadRequestException(`Recebimento (${qtd}) excede o saldo pendente (${pendente}) do item.`);
        }
        remessa.push({ item, qtd, loteNumero: linha.loteNumero, dataValidade: linha.dataValidade });
      }
    } else {
      for (const item of oc.itens) {
        const pendente = pendentePorItem.get(item.id) ?? 0;
        if (pendente > 0) remessa.push({ item, qtd: pendente });
      }
    }

    if (remessa.length === 0) throw new BadRequestException('Nada a receber: todos os itens já foram recebidos.');

    const valorRemessa = r2(remessa.reduce((s, l) => s + l.qtd * Number(l.item.precoUnitario), 0));

    // 1. Entrada de mercadoria (cabeçalho + itens da remessa).
    const entrada = await this.prisma.entradaMercadoria.create({
      data: {
        tenantId,
        fornecedorId: oc.fornecedorId,
        numeroNf: `OC-${oc.numero}`,
        dataEntrada: new Date(),
        valorTotal: valorRemessa,
        status: 'CONFERIDA',
        observacoes: `Recebimento da OC #${oc.numero}`,
        itens: {
          create: remessa.map((l) => ({
            produtoId: l.item.produtoId,
            descricao: l.item.descricao,
            quantidade: l.qtd,
            unidade: l.item.unidade,
            valorUnitario: Number(l.item.precoUnitario),
            valorTotal: r2(l.qtd * Number(l.item.precoUnitario)),
            loteNumero: l.loteNumero || null,
            dataValidade: l.dataValidade ? new Date(l.dataValidade) : null,
          })),
        },
      },
    });

    // Novo status: ENTREGUE se todos os itens ficaram sem saldo pendente; senão PARCIAL.
    const totalmente = oc.itens.every((item) => {
      const recebidoAgora = remessa.filter((l) => l.item.id === item.id).reduce((s, l) => s + l.qtd, 0);
      return Number(item.quantidadeRecebida) + recebidoAgora >= Number(item.quantidade) - 1e-6;
    });
    const novoStatus = totalmente ? StatusOrdemCompra.ENTREGUE : StatusOrdemCompra.PARCIAL;

    // 2. Contas a Pagar (da remessa, vinculado à entrada) + quantidadeRecebida + status,
    //    numa transação. Feito ANTES da baixa de estoque de propósito: a entrada de compra
    //    dispara o listener `estoque.entrada_compra` (contas-pagar.service) que também gera
    //    um título — como ele é idempotente por `entradaId`, criar a conta aqui primeiro faz
    //    o listener pular (senão haveria cobrança dupla, com condição de corrida). Esta conta
    //    ainda respeita a condição de pagamento da OC, que o listener genérico ignora.
    const resultados = await this.prisma.$transaction([
      this.prisma.contaPagar.create({
        data: {
          tenantId, filialId: oc.filialId, fornecedorId: oc.fornecedorId,
          entradaId: entrada.id,
          descricao: `Compra — OC #${oc.numero}${totalmente ? '' : ' (parcial)'}`,
          valorOriginal: valorRemessa,
          dataVencimento: this.vencimentoPorCondicao(oc.condicaoPagamento),
          status: 'ABERTO',
        },
      }),
      ...remessa.map((l) =>
        this.prisma.itemOrdemCompra.update({
          where: { id: l.item.id },
          data: { quantidadeRecebida: r2(Number(l.item.quantidadeRecebida) + l.qtd) },
        }),
      ),
      this.prisma.ordemCompra.update({
        where: { id },
        data: {
          status: novoStatus,
          entradaId: entrada.id,
          ...(totalmente ? { dataEntregaReal: new Date() } : {}),
        },
      }),
    ]);
    // A OC atualizada é o último elemento da transação (após conta + N updates de item).
    const atualizado = resultados[resultados.length - 1];

    // 3. Baixa no estoque (após a conta existir, para o listener idempotente pular).
    //    OBS: usa a transação interna do `movimentar`; torná-la atômica com o resto
    //    exige `movimentar` aceitar um `tx` externo (P1-1 — refatoração do núcleo WMS).
    for (const l of remessa) {
      if (!l.item.produtoId) continue;
      await this.estoque.movimentar(tenantId, {
        filialId: oc.filialId,
        produtoId: l.item.produtoId,
        tipo: TipoMovimentacao.ENTRADA_COMPRA,
        quantidade: l.qtd,
        custoUnitario: Number(l.item.precoUnitario),
        usuarioId,
        entradaId: entrada.id,
        observacoes: `Recebimento OC #${oc.numero}`,
      });
    }

    return atualizado;
  }

  /** Converte a condição de pagamento num vencimento simples (à vista = hoje). */
  private vencimentoPorCondicao(cond?: string | null): Date {
    const hoje = new Date();
    if (!cond || cond === 'A_VISTA') return hoje;
    const m = String(cond).match(/\d+/);
    const dias = m ? Number(m[0]) : 30;
    return new Date(hoje.getTime() + dias * 86400000);
  }
}
