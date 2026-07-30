import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { TipoMovimentacao } from '@prisma/client';

/**
 * Entrada de mercadorias (recebimento).
 * O XML da NF-e do fornecedor é parseado no frontend; aqui recebemos os itens já
 * estruturados, damos entrada no estoque (ENTRADA_COMPRA), criamos lote com validade
 * (rastreabilidade FLV) e, opcionalmente, geramos o Contas a Pagar.
 */
@Injectable()
export class EntradasService {
  constructor(private prisma: PrismaService, private estoque: EstoqueService) {}

  async findAll(tenantId: string, filtros?: { status?: string; search?: string }) {
    return this.prisma.entradaMercadoria.findMany({
      where: {
        tenantId,
        ...(filtros?.status && { status: filtros.status }),
        ...(filtros?.search && {
          OR: [
            { numeroNf: { contains: filtros.search } },
            { chaveNfeEntrada: { contains: filtros.search } },
            { fornecedor: { razaoSocial: { contains: filtros.search, mode: 'insensitive' as any } } },
          ],
        }),
      },
      include: { fornecedor: { select: { razaoSocial: true, nomeFantasia: true } }, _count: { select: { itens: true } } },
      orderBy: { dataEntrada: 'desc' },
      take: 300,
    });
  }

  async findOne(tenantId: string, id: string) {
    const e = await this.prisma.entradaMercadoria.findFirst({
      where: { id, tenantId },
      include: { fornecedor: true, itens: true },
    });
    if (!e) throw new NotFoundException('Entrada não encontrada.');
    return e;
  }

  /**
   * Cria a entrada + dá baixa de estoque (entrada). Se `gerarContaPagar`, cria o título.
   */
  async create(tenantId: string, usuarioId: string, dto: any) {
    if (!dto.fornecedorId) throw new BadRequestException('Selecione o fornecedor.');
    if (!dto.filialId) throw new BadRequestException('Selecione a filial de destino.');
    if (!Array.isArray(dto.itens) || dto.itens.length === 0) throw new BadRequestException('Informe ao menos um item.');

    const valorTotal = dto.itens.reduce((s: number, i: any) => s + (Number(i.valorTotal) || 0), 0);

    const entrada = await this.prisma.entradaMercadoria.create({
      data: {
        tenantId,
        fornecedorId: dto.fornecedorId,
        chaveNfeEntrada: dto.chaveNfeEntrada || null,
        xmlOriginal: dto.xmlOriginal || null,
        numeroNf: dto.numeroNf || null,
        serieNf: dto.serieNf || null,
        dataEmissao: dto.dataEmissao ? new Date(dto.dataEmissao) : null,
        valorTotal,
        status: 'CONFERIDA',
        observacoes: dto.observacoes || null,
        itens: {
          create: dto.itens.map((i: any) => ({
            produtoId: i.produtoId || null,
            descricao: i.descricao,
            ncm: i.ncm || null,
            quantidade: Number(i.quantidade) || 0,
            unidade: i.unidade || 'UN',
            valorUnitario: Number(i.valorUnitario) || 0,
            valorTotal: Number(i.valorTotal) || 0,
            loteNumero: i.loteNumero || null,
            dataValidade: i.dataValidade ? new Date(i.dataValidade) : null,
          })),
        },
      },
      include: { itens: true },
    });

    // Dá entrada no estoque para cada item com produto vinculado
    for (const item of entrada.itens) {
      if (!item.produtoId) continue;
      let loteId: string | undefined;
      if (item.loteNumero) {
        const lote = await this.prisma.lote.upsert({
          where: { tenantId_produtoId_numero: { tenantId, produtoId: item.produtoId, numero: item.loteNumero } },
          update: { dataValidade: item.dataValidade || undefined },
          create: {
            tenantId, produtoId: item.produtoId, numero: item.loteNumero,
            dataValidade: item.dataValidade || undefined, quantidadeInicial: Number(item.quantidade),
          },
        });
        loteId = lote.id;
      }
      await this.estoque.movimentar(tenantId, {
        filialId: dto.filialId, produtoId: item.produtoId, tipo: TipoMovimentacao.ENTRADA_COMPRA,
        quantidade: Number(item.quantidade), custoUnitario: Number(item.valorUnitario),
        loteId, entradaId: entrada.id, usuarioId,
        observacoes: `Entrada NF ${entrada.numeroNf || ''} — ${entrada.fornecedorId.slice(0, 6)}`,
      });
    }

    // Vinculada a uma Ordem de Compra? Marca a OC como entregue (sem re-movimentar estoque).
    if (dto.ordemCompraId) {
      try {
        const oc = await this.prisma.ordemCompra.findFirst({ where: { id: dto.ordemCompraId, tenantId }, include: { itens: true } });
        if (oc && oc.status !== 'ENTREGUE' && oc.status !== 'CANCELADA') {
          await this.prisma.ordemCompra.update({
            where: { id: oc.id },
            data: { status: 'ENTREGUE', dataEntregaReal: new Date(), entradaId: entrada.id },
          });
          for (const it of oc.itens) {
            await this.prisma.itemOrdemCompra.update({ where: { id: it.id }, data: { quantidadeRecebida: it.quantidade } });
          }
        }
      } catch { /* não bloqueia a entrada se a OC falhar */ }
    }

    // Contas a pagar (opcional)
    if (dto.gerarContaPagar) {
      await this.prisma.contaPagar.create({
        data: {
          tenantId, filialId: dto.filialId, fornecedorId: dto.fornecedorId, entradaId: entrada.id,
          descricao: `Compra — NF ${entrada.numeroNf || entrada.id.slice(0, 8)}`,
          valorOriginal: valorTotal,
          dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : new Date(Date.now() + 30 * 86400000),
          status: 'ABERTO',
        },
      });
    }

    return entrada;
  }
}
