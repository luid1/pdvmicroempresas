import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, q?: string) {
    const produtos = await this.prisma.produto.findMany({
      where: {
        tenantId, ativo: true,
        ...(q && {
          OR: [
            { descricao: { contains: q, mode: 'insensitive' as any } },
            { codigo: { contains: q, mode: 'insensitive' as any } },
            { codigoBarras: { contains: q } },
          ],
        }),
      },
      include: {
        unidadeMedida: { select: { sigla: true } },
        estoques: { select: { quantidade: true } },
      },
      orderBy: { descricao: 'asc' },
      take: 500,
    });
    // Enriquecer com estoque total (kg) e estimativa de caixas
    return produtos.map((p) => {
      const estoqueKg = p.estoques.reduce((s, e) => s + Number(e.quantidade), 0);
      const pesoCx = Number(p.pesoCaixaria) || 0;
      const estoqueCaixas = pesoCx > 0 ? estoqueKg / pesoCx : null;
      const { estoques, ...rest } = p as any;
      return { ...rest, estoqueKg, estoqueCaixas };
    });
  }

  async listarUnidades(tenantId: string) {
    return this.prisma.unidadeMedida.findMany({ where: { tenantId }, orderBy: { sigla: 'asc' } });
  }

  /** Categorias que realmente existem em produtos ativos (pra popular filtros). */
  async listarCategorias(tenantId: string): Promise<string[]> {
    const grupos = await this.prisma.produto.groupBy({
      by: ['categoria'],
      where: { tenantId, ativo: true, categoria: { not: null } },
    });
    return grupos
      .map((g) => g.categoria as string)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async create(tenantId: string, dto: any) {
    const num = (v: any) => (v === '' || v === null || v === undefined ? undefined : Number(v));
    // Resolve a unidade de medida pela sigla (cria se não existir)
    const sigla = (dto.unidadeSigla || 'KG').toUpperCase();
    let unidade = await this.prisma.unidadeMedida.findFirst({ where: { tenantId, sigla } });
    if (!unidade) unidade = await this.prisma.unidadeMedida.create({ data: { tenantId, sigla, descricao: sigla } });
    // Gera código sequencial simples se não informado
    const codigo = dto.codigo || `P${Date.now().toString().slice(-6)}`;
    const exists = await this.prisma.produto.findFirst({ where: { tenantId, codigo } });
    if (exists) throw new ConflictException('Já existe produto com este código.');

    return this.prisma.produto.create({
      data: {
        tenantId,
        codigo,
        codigoBarras: dto.codigoBarras || null,
        descricao: dto.descricao,
        ncm: dto.ncm || '00000000',
        cfop: dto.cfop || null,
        categoria: dto.categoria || null,
        grupo: dto.grupo || null,
        marca: dto.marca || null,
        classificacao: dto.classificacao || null,
        tipoCaixaria: dto.tipoCaixaria || null,
        pesoCaixaria: num(dto.pesoCaixaria),
        pesoLiquido: num(dto.pesoLiquido),
        precoVenda: num(dto.precoVenda) ?? 0,
        unidadeMedidaId: unidade.id,
      },
      include: { unidadeMedida: { select: { sigla: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    const p = await this.prisma.produto.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    // Inativa em vez de excluir (preserva histórico de movimentações/NF-e)
    return this.prisma.produto.update({ where: { id }, data: { ativo: false } });
  }

  async update(tenantId: string, id: string, dto: any) {
    const p = await this.prisma.produto.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Produto não encontrado.');
    const num = (v: any) => (v === '' || v === null || v === undefined ? undefined : Number(v));

    // Se veio composição de custo, recalcula o precoCusto (custo real com absorção da perda).
    const temComposicao = ['custoBase', 'custoAliquotaImp', 'custoEmbalagem', 'custoFrete', 'custoChapa', 'fatorPerdaPct']
      .some((k) => dto[k] !== undefined);
    const pick = (k: string) => (dto[k] !== undefined ? Number(dto[k] || 0) : Number((p as any)[k] || 0));
    let precoCustoCalc = num(dto.precoCusto);
    if (temComposicao) {
      const base = pick('custoBase');
      const antesPerda = base + base * (pick('custoAliquotaImp') / 100) + pick('custoEmbalagem') + pick('custoFrete') + pick('custoChapa');
      const perda = Math.min(99.99, pick('fatorPerdaPct'));
      precoCustoCalc = Math.round((antesPerda / (1 - perda / 100)) * 10000) / 10000; // absorção da perda
    }

    await this.prisma.produto.update({
      where: { id },
      data: {
        descricao: dto.descricao ?? undefined,
        codigo: dto.codigo ?? undefined,
        codigoBarras: dto.codigoBarras ?? undefined,
        ncm: dto.ncm ?? undefined,
        cfop: dto.cfop ?? undefined,
        categoria: dto.categoria ?? undefined,
        grupo: dto.grupo ?? undefined,
        marca: dto.marca ?? undefined,
        classificacao: dto.classificacao ?? undefined,
        tipoCaixaria: dto.tipoCaixaria ?? undefined,
        pesoCaixaria: num(dto.pesoCaixaria),
        pesoLiquido: num(dto.pesoLiquido),
        pesoBruto: num(dto.pesoBruto),
        precoVenda: num(dto.precoVenda),
        precoCusto: precoCustoCalc,
        // Composição analítica do custo
        custoBase: num(dto.custoBase),
        custoAliquotaImp: num(dto.custoAliquotaImp),
        custoEmbalagem: num(dto.custoEmbalagem),
        custoFrete: num(dto.custoFrete),
        custoChapa: num(dto.custoChapa),
        fatorPerdaPct: num(dto.fatorPerdaPct),
      },
    });
    return this.prisma.produto.findUnique({ where: { id }, include: { unidadeMedida: { select: { sigla: true } } } });
  }

  /**
   * Busca rápida (autocomplete) por código, descrição ou código de barras.
   * Já devolve o saldo disponível (quantidade - reservada) na filial informada.
   */
  async search(tenantId: string, q: string, filialId?: string) {
    const produtos = await this.prisma.produto.findMany({
      where: {
        tenantId,
        ativo: true,
        ...(q && {
          OR: [
            { descricao: { contains: q, mode: 'insensitive' as any } },
            { codigo: { contains: q, mode: 'insensitive' as any } },
            { codigoBarras: { contains: q } },
          ],
        }),
      },
      include: {
        unidadeMedida: { select: { sigla: true } },
        estoques: filialId
          ? { where: { filialId }, select: { quantidade: true, quantidadeReservada: true } }
          : { select: { quantidade: true, quantidadeReservada: true } },
      },
      orderBy: { descricao: 'asc' },
      take: 30,
    });

    return produtos.map((p) => {
      const disponivel = p.estoques.reduce(
        (s, e) => s + (Number(e.quantidade) - Number(e.quantidadeReservada)),
        0,
      );
      return {
        id: p.id,
        codigo: p.codigo,
        codigoBarras: p.codigoBarras,
        descricao: p.descricao,
        ncm: p.ncm,
        cfop: p.cfop,
        unidade: p.unidadeMedida?.sigla || 'UN',
        precoVenda: Number(p.precoVenda),
        estoqueDisponivel: disponivel,
      };
    });
  }
}
