import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money } from '../../common/utils/money.util';

/**
 * Motor de precificação por tabela comercial (Frente M.2).
 *
 * Precedência do preço de venda de um item de pedido:
 *   1) Promoção vigente na tabela do cliente (promoAtiva + janela promoInicio/promoFim)
 *   2) Preço fixo da tabela do cliente (PrecoTabela.preco)
 *   3) Produto.precoVenda (fallback do cadastro)
 *
 * A tabela do cliente vem de Cliente.tabelaPreco (TABELA_A/TABELA_B/ESPECIAL).
 * Sem FK com Produto → join manual por produtoId.
 */
@Injectable()
export class PrecificacaoService {
  constructor(private prisma: PrismaService) {}

  private dentroDaPromo(pt: { promoAtiva: boolean; promoPreco: any; promoInicio: Date | null; promoFim: Date | null }, data: Date): boolean {
    if (!pt.promoAtiva || pt.promoPreco == null) return false;
    if (pt.promoInicio && data < pt.promoInicio) return false;
    if (pt.promoFim && data > pt.promoFim) return false;
    return true;
  }

  /**
   * Resolve o preço de UM produto para uma tabela/data.
   * Retorna também a origem ('PROMOCAO' | 'TABELA' | 'PRODUTO') e a margem sobre custo.
   */
  async resolverPreco(
    tenantId: string,
    produtoId: string,
    opts?: { tabela?: string | null; clienteId?: string; data?: string | Date },
  ) {
    const data = opts?.data ? new Date(opts.data) : new Date();

    const produto = await this.prisma.produto.findFirst({
      where: { id: produtoId, tenantId },
      select: { id: true, descricao: true, codigo: true, precoVenda: true, precoCusto: true, margemMinima: true },
    });
    if (!produto) throw new NotFoundException(`Produto ${produtoId} não encontrado.`);

    // Descobre a tabela: prioridade para o parâmetro explícito, senão via cliente.
    let tabela = opts?.tabela || null;
    if (!tabela && opts?.clienteId) {
      const cli = await this.prisma.cliente.findFirst({
        where: { id: opts.clienteId, tenantId },
        select: { tabelaPreco: true },
      });
      tabela = cli?.tabelaPreco || null;
    }

    let preco = money(produto.precoVenda);
    let origem: 'PROMOCAO' | 'TABELA' | 'PRODUTO' = 'PRODUTO';
    let tabelaAplicada: string | null = null;

    if (tabela) {
      const pt = await this.prisma.precoTabela.findUnique({
        where: { tenantId_produtoId_tabela: { tenantId, produtoId, tabela } },
      });
      if (pt && pt.ativo) {
        tabelaAplicada = tabela;
        if (this.dentroDaPromo(pt, data)) {
          preco = money(pt.promoPreco);
          origem = 'PROMOCAO';
        } else {
          preco = money(pt.preco);
          origem = 'TABELA';
        }
      }
    }

    const custo = money(produto.precoCusto);
    const margemPct = custo > 0 ? money(((preco - custo) / custo) * 100) : 0;
    const abaixoMargem = Number(produto.margemMinima) > 0 && margemPct < Number(produto.margemMinima);

    return {
      produtoId,
      descricao: produto.descricao,
      codigo: produto.codigo,
      tabela: tabelaAplicada,
      preco,
      origem,
      precoCusto: custo,
      margemPct,
      margemMinima: Number(produto.margemMinima),
      abaixoMargem,
    };
  }

  /** Resolve preços em lote (usado ao montar um pedido). */
  async resolverLote(
    tenantId: string,
    produtoIds: string[],
    opts?: { tabela?: string | null; clienteId?: string; data?: string | Date },
  ) {
    const ids = Array.from(new Set(produtoIds.filter(Boolean)));
    const out: Record<string, any> = {};
    for (const id of ids) {
      out[id] = await this.resolverPreco(tenantId, id, opts);
    }
    return out;
  }

  // ─────────────── CRUD de PrecoTabela ───────────────

  async listar(tenantId: string, filtros?: { produtoId?: string; tabela?: string; search?: string }) {
    const precos = await this.prisma.precoTabela.findMany({
      where: {
        tenantId,
        ...(filtros?.produtoId && { produtoId: filtros.produtoId }),
        ...(filtros?.tabela && { tabela: filtros.tabela }),
      },
      orderBy: [{ tabela: 'asc' }, { createdAt: 'desc' }],
      take: 1000,
    });

    // Enriquecer com dados do produto (descrição/código/preços de referência)
    const prodIds = Array.from(new Set(precos.map((p) => p.produtoId)));
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: prodIds } },
      select: { id: true, descricao: true, codigo: true, precoVenda: true, precoCusto: true },
    });
    const mapProd = new Map(produtos.map((p) => [p.id, p]));

    let lista = precos.map((p) => ({
      ...p,
      preco: money(p.preco),
      promoPreco: p.promoPreco != null ? money(p.promoPreco) : null,
      produtoDescricao: mapProd.get(p.produtoId)?.descricao || '—',
      produtoCodigo: mapProd.get(p.produtoId)?.codigo || '—',
      produtoPrecoVenda: money(mapProd.get(p.produtoId)?.precoVenda ?? 0),
      produtoPrecoCusto: money(mapProd.get(p.produtoId)?.precoCusto ?? 0),
    }));

    if (filtros?.search) {
      const s = filtros.search.toLowerCase();
      lista = lista.filter(
        (p) => p.produtoDescricao.toLowerCase().includes(s) || p.produtoCodigo.toLowerCase().includes(s),
      );
    }
    return lista;
  }

  /** Cria/atualiza o preço de um produto numa tabela (idempotente pela unique key). */
  async upsert(tenantId: string, dto: {
    produtoId: string;
    tabela: string;
    preco: number;
    promoAtiva?: boolean;
    promoPreco?: number | null;
    promoInicio?: string | null;
    promoFim?: string | null;
    ativo?: boolean;
  }) {
    if (!dto.produtoId) throw new BadRequestException('Selecione o produto.');
    if (!dto.tabela) throw new BadRequestException('Informe a tabela (TABELA_A/TABELA_B/ESPECIAL).');
    if (dto.preco == null || Number(dto.preco) < 0) throw new BadRequestException('Preço inválido.');

    const produto = await this.prisma.produto.findFirst({ where: { id: dto.produtoId, tenantId }, select: { id: true } });
    if (!produto) throw new BadRequestException('Produto não encontrado.');

    const data = {
      preco: new Prisma.Decimal(money(dto.preco)),
      promoAtiva: !!dto.promoAtiva,
      promoPreco: dto.promoPreco != null ? new Prisma.Decimal(money(dto.promoPreco)) : null,
      promoInicio: dto.promoInicio ? new Date(dto.promoInicio) : null,
      promoFim: dto.promoFim ? new Date(dto.promoFim) : null,
      ativo: dto.ativo ?? true,
    };

    return this.prisma.precoTabela.upsert({
      where: { tenantId_produtoId_tabela: { tenantId, produtoId: dto.produtoId, tabela: dto.tabela } },
      update: data,
      create: { tenantId, produtoId: dto.produtoId, tabela: dto.tabela, ...data },
    });
  }

  async remover(tenantId: string, id: string) {
    const pt = await this.prisma.precoTabela.findFirst({ where: { id, tenantId } });
    if (!pt) throw new NotFoundException('Preço de tabela não encontrado.');
    await this.prisma.precoTabela.delete({ where: { id } });
    return { ok: true };
  }
}
