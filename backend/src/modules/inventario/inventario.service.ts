import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { TipoMovimentacao } from '@prisma/client';

/**
 * Inventário / contagem física.
 * Fluxo: abrir (tira um "retrato" do saldo do sistema por produto) → contar (informar
 * a quantidade física) → fechar (gera os ajustes de estoque das diferenças).
 */
@Injectable()
export class InventarioService {
  constructor(private prisma: PrismaService, private estoque: EstoqueService) {}

  async findAll(tenantId: string) {
    return this.prisma.inventario.findMany({
      where: { tenantId },
      include: { filial: { select: { nome: true } }, usuario: { select: { nome: true } }, _count: { select: { itens: true } } },
      orderBy: { dataInicio: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const inv = await this.prisma.inventario.findFirst({
      where: { id, tenantId },
      include: {
        filial: { select: { nome: true } },
        itens: { include: { produto: { select: { codigo: true, descricao: true, unidadeMedida: { select: { sigla: true } } } } } },
      },
    });
    if (!inv) throw new NotFoundException('Inventário não encontrado.');
    // ordena por descrição do produto
    inv.itens.sort((a, b) => (a.produto?.descricao || '').localeCompare(b.produto?.descricao || ''));
    return inv;
  }

  /** Abre um inventário e congela o saldo atual do sistema como quantidadeSistema. */
  async abrir(tenantId: string, usuarioId: string, dto: { filialId: string; descricao?: string; categoria?: string }) {
    if (!dto.filialId) throw new BadRequestException('Selecione a filial.');

    // Todos os produtos ativos (opcionalmente por categoria) — inventário conta tudo,
    // inclusive itens com saldo zero (pra achar estoque físico não registrado).
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, ativo: true, ...(dto.categoria && { categoria: dto.categoria }) },
      select: { id: true },
    });
    if (produtos.length === 0) throw new BadRequestException('Nenhum produto ativo para inventariar.');

    // Saldo do sistema por produto (soma lotes/localizações da filial)
    const saldos = await this.prisma.estoqueSaldo.findMany({
      where: { tenantId, filialId: dto.filialId, produtoId: { in: produtos.map((p) => p.id) } },
      select: { produtoId: true, quantidade: true },
    });
    const porProduto = new Map<string, number>();
    for (const s of saldos) porProduto.set(s.produtoId, (porProduto.get(s.produtoId) || 0) + Number(s.quantidade));

    const inv = await this.prisma.inventario.create({
      data: {
        tenantId, filialId: dto.filialId, usuarioId,
        descricao: dto.descricao || `Inventário ${new Date().toLocaleDateString('pt-BR')}`,
        status: 'EM_CONTAGEM',
        itens: {
          create: produtos.map((p) => ({
            produtoId: p.id, quantidadeSistema: porProduto.get(p.id) || 0, quantidadeContada: null, diferenca: null,
          })),
        },
      },
      include: { _count: { select: { itens: true } } },
    });
    return inv;
  }

  /** Grava a contagem de um item e calcula a diferença. */
  async contar(tenantId: string, itemId: string, quantidadeContada: number) {
    const item = await this.prisma.itemInventario.findFirst({
      where: { id: itemId, inventario: { tenantId } },
    });
    if (!item) throw new NotFoundException('Item de inventário não encontrado.');
    const contada = Number(quantidadeContada);
    const diferenca = contada - Number(item.quantidadeSistema);
    return this.prisma.itemInventario.update({
      where: { id: itemId },
      data: { quantidadeContada: contada, diferenca },
    });
  }

  /** Fecha o inventário: gera ajuste de estoque para cada item com diferença. */
  async fechar(tenantId: string, usuarioId: string, id: string) {
    const inv = await this.prisma.inventario.findFirst({ where: { id, tenantId }, include: { itens: true } });
    if (!inv) throw new NotFoundException('Inventário não encontrado.');
    if (inv.status === 'FECHADO') throw new BadRequestException('Inventário já está fechado.');

    let ajustes = 0;
    for (const item of inv.itens) {
      if (item.quantidadeContada === null || item.ajusteGerado) continue;
      const dif = Number(item.diferenca || 0);
      if (dif === 0) continue;
      await this.estoque.movimentar(tenantId, {
        filialId: inv.filialId, produtoId: item.produtoId,
        tipo: dif > 0 ? TipoMovimentacao.AJUSTE_POSITIVO : TipoMovimentacao.AJUSTE_NEGATIVO,
        quantidade: Math.abs(dif), permitirNegativo: true, usuarioId,
        observacoes: `Ajuste de inventário ${inv.descricao}`,
      });
      await this.prisma.itemInventario.update({
        where: { id: item.id }, data: { ajusteGerado: true, tipoAjuste: 'DIFERENCA_CONTAGEM' },
      });
      ajustes++;
    }

    await this.prisma.inventario.update({ where: { id }, data: { status: 'FECHADO', dataFim: new Date() } });
    return { status: 'FECHADO', ajustesGerados: ajustes };
  }
}
