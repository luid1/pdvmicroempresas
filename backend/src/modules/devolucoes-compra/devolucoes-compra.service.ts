import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, TipoMovimentacao, StatusFinanceiro } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { money, sumMoney } from '../../common/utils/money.util';
import { proximoNumero } from '../../common/utils/sequencia.util';

interface ItemDevolucaoDto {
  produtoId: string;
  descricao?: string;
  quantidade: number;
  valorUnitario?: number;
  loteId?: string;
}

interface CriarDevolucaoDto {
  filialId: string;
  fornecedorId?: string;
  entradaId?: string;
  motivo?: string;
  observacoes?: string;
  itens: ItemDevolucaoDto[];
}

/**
 * Devolução de mercadoria ao FORNECEDOR (Frente M.1).
 *
 * Efeitos:
 *  1) Baixa o estoque de cada item via SAIDA_DEVOLUCAO_FORNECEDOR (FEFO), com custo do item.
 *  2) Reduz/estorna o Contas a Pagar vinculado à entrada de origem (se existir e em aberto):
 *     - devolução parcial → reduz valorOriginal;
 *     - devolução que zera o saldo → cancela o título.
 *
 * Como a Conta a Pagar de uma entrada NÃO carrega lançamento no DRE (o EntradasService
 * cria o título sem planoContasCodigo), reduzir valorOriginal é seguro e não desbalanceia
 * o razão. Quando o título é cancelado, o service financeiro faz o estorno padrão.
 */
@Injectable()
export class DevolucoesCompraService {
  constructor(private prisma: PrismaService, private estoque: EstoqueService) {}

  async findAll(tenantId: string, filtros?: { fornecedorId?: string; status?: string }) {
    const lista = await this.prisma.devolucaoCompra.findMany({
      where: {
        tenantId,
        ...(filtros?.fornecedorId && { fornecedorId: filtros.fornecedorId }),
        ...(filtros?.status && { status: filtros.status }),
      },
      include: { itens: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    // Enriquecer com nome do fornecedor
    const fornIds = Array.from(new Set(lista.map((d) => d.fornecedorId)));
    const forns = await this.prisma.fornecedor.findMany({
      where: { tenantId, id: { in: fornIds } },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });
    const mapF = new Map(forns.map((f) => [f.id, f]));
    return lista.map((d) => ({
      ...d,
      valorTotal: money(d.valorTotal),
      fornecedorNome: mapF.get(d.fornecedorId)?.nomeFantasia || mapF.get(d.fornecedorId)?.razaoSocial || '—',
    }));
  }

  async findOne(tenantId: string, id: string) {
    const d = await this.prisma.devolucaoCompra.findFirst({ where: { id, tenantId }, include: { itens: true } });
    if (!d) throw new NotFoundException('Devolução não encontrada.');
    return d;
  }

  async create(tenantId: string, usuarioId: string, dto: CriarDevolucaoDto) {
    if (!dto.filialId) throw new BadRequestException('Selecione a filial.');
    if (!Array.isArray(dto.itens) || dto.itens.length === 0) throw new BadRequestException('Informe ao menos um item.');

    // Resolve a entrada de origem (para custo/fornecedor default) se informada.
    let entrada: any = null;
    if (dto.entradaId) {
      entrada = await this.prisma.entradaMercadoria.findFirst({
        where: { id: dto.entradaId, tenantId },
        include: { itens: true },
      });
      if (!entrada) throw new BadRequestException('Entrada de origem não encontrada.');
    }

    const fornecedorId = dto.fornecedorId || entrada?.fornecedorId;
    if (!fornecedorId) throw new BadRequestException('Informe o fornecedor da devolução.');

    // Monta itens, resolvendo custo unitário: dto → item da entrada → precoCusto do produto.
    const prodIds = Array.from(new Set(dto.itens.map((i) => i.produtoId).filter(Boolean)));
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: prodIds } },
      select: { id: true, descricao: true, precoCusto: true },
    });
    const mapProd = new Map(produtos.map((p) => [p.id, p]));

    const itens = dto.itens.map((i) => {
      if (!i.produtoId) throw new BadRequestException('Item sem produto.');
      const qtd = Number(i.quantidade) || 0;
      if (qtd <= 0) throw new BadRequestException('Quantidade do item deve ser positiva.');
      const prod = mapProd.get(i.produtoId);
      const itemEntrada = entrada?.itens?.find((ie: any) => ie.produtoId === i.produtoId);
      const custoUnit =
        i.valorUnitario != null
          ? money(i.valorUnitario)
          : itemEntrada
          ? money(itemEntrada.valorUnitario)
          : money(prod?.precoCusto ?? 0);
      return {
        produtoId: i.produtoId,
        descricao: i.descricao || prod?.descricao || 'Item',
        quantidade: qtd,
        valorUnitario: custoUnit,
        valorTotal: money(qtd * custoUnit),
        loteId: i.loteId || null,
      };
    });

    const valorTotal = sumMoney(itens.map((i) => i.valorTotal));

    // Numeração sequencial por tenant.
    const numero = await proximoNumero(this.prisma, tenantId, 'devolucao-compra');

    // 1) Baixa de estoque (FEFO) — devolução ao fornecedor.
    for (const it of itens) {
      await this.estoque.baixarFefo(tenantId, {
        filialId: dto.filialId,
        produtoId: it.produtoId,
        quantidade: it.quantidade,
        loteId: it.loteId || undefined,
        tipo: TipoMovimentacao.SAIDA_DEVOLUCAO_FORNECEDOR,
        usuarioId,
        observacoes: `Devolução compra #${numero} — ${dto.motivo || ''}`.trim(),
      });
    }

    // 2) Estorno/redução do Contas a Pagar da entrada.
    let contaPagarId: string | null = null;
    if (dto.entradaId) {
      const cp = await this.prisma.contaPagar.findFirst({
        where: {
          tenantId,
          entradaId: dto.entradaId,
          status: { in: [StatusFinanceiro.ABERTO, StatusFinanceiro.PARCIAL, StatusFinanceiro.VENCIDO] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (cp) {
        contaPagarId = cp.id;
        const saldo = money(Number(cp.valorOriginal) - Number(cp.valorPago));
        if (valorTotal >= saldo - 0.0001) {
          // Devolução cobre todo o saldo em aberto → cancela o título.
          await this.prisma.contaPagar.update({
            where: { id: cp.id },
            data: {
              status: StatusFinanceiro.CANCELADO,
              observacoes: `${cp.observacoes ? cp.observacoes + ' | ' : ''}Cancelado por devolução compra #${numero}.`,
            },
          });
        } else {
          // Redução parcial do valor devido.
          const novoValor = money(Number(cp.valorOriginal) - valorTotal);
          await this.prisma.contaPagar.update({
            where: { id: cp.id },
            data: {
              valorOriginal: new Prisma.Decimal(novoValor),
              observacoes: `${cp.observacoes ? cp.observacoes + ' | ' : ''}Reduzido R$ ${valorTotal.toFixed(2)} por devolução compra #${numero}.`,
            },
          });
        }
      }
    }

    // 3) Persiste a devolução + itens.
    return this.prisma.devolucaoCompra.create({
      data: {
        tenantId,
        filialId: dto.filialId,
        fornecedorId,
        entradaId: dto.entradaId || null,
        numero,
        motivo: dto.motivo || null,
        valorTotal: new Prisma.Decimal(valorTotal),
        status: 'CONFIRMADA',
        contaPagarId,
        usuarioId,
        observacoes: dto.observacoes || null,
        itens: {
          create: itens.map((i) => ({
            produtoId: i.produtoId,
            descricao: i.descricao,
            quantidade: new Prisma.Decimal(i.quantidade),
            valorUnitario: new Prisma.Decimal(i.valorUnitario),
            valorTotal: new Prisma.Decimal(i.valorTotal),
            loteId: i.loteId,
          })),
        },
      },
      include: { itens: true },
    });
  }
}
