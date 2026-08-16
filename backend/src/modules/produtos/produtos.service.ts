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
            { codigoBarrasSecun: { contains: q } },
            { codigoBarrasCaixa: { contains: q } },
            { skuFornecedor: { contains: q, mode: 'insensitive' as any } },
            { referencia: { contains: q, mode: 'insensitive' as any } },
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
    await this.validarCodigosBarras(tenantId, dto);

    return this.prisma.produto.create({
      data: {
        tenantId,
        codigo,
        codigoBarras: dto.codigoBarras || null,
        codigoBarrasSecun: dto.codigoBarrasSecun || null,
        codigoBarrasCaixa: dto.codigoBarrasCaixa || null,
        gtinTributavel: dto.gtinTributavel || null,
        skuFornecedor: dto.skuFornecedor || null,
        referencia: dto.referencia || null,
        fabricante: dto.fabricante || null,
        descricao: dto.descricao,
        descricaoCompleta: dto.descricaoCompleta || null,
        descricaoFiscal: dto.descricaoFiscal || null,
        ncm: dto.ncm || '00000000',
        cest: dto.cest || null,
        exTipi: dto.exTipi || null,
        codigoBeneficioFiscal: dto.codigoBeneficioFiscal || null,
        generoItem: dto.generoItem || null,
        cfop: dto.cfop || null,
        categoria: dto.categoria || null,
        grupo: dto.grupo || null,
        subgrupo: dto.subgrupo || null,
        marca: dto.marca || null,
        classificacao: dto.classificacao || null,
        tipoCaixaria: dto.tipoCaixaria || null,
        pesoCaixaria: num(dto.pesoCaixaria),
        pesoLiquido: num(dto.pesoLiquido),
        pesoBruto: num(dto.pesoBruto),
        alturaCm: num(dto.alturaCm),
        larguraCm: num(dto.larguraCm),
        comprimentoCm: num(dto.comprimentoCm),
        quantidadeEmbalagem: num(dto.quantidadeEmbalagem) ?? 1,
        multiploCompra: num(dto.multiploCompra) ?? 1,
        precoCompra: num(dto.precoCompra) ?? 0,
        precoVenda: num(dto.precoVenda) ?? 0,
        estoqueMinimo: num(dto.estoqueMinimo) ?? 0,
        estoqueMaximo: num(dto.estoqueMaximo),
        estoqueSeguranca: num(dto.estoqueSeguranca) ?? 0,
        pontoReposicao: num(dto.pontoReposicao) ?? 0,
        leadTimeDias: Number(dto.leadTimeDias || 0),
        localizacaoPadrao: dto.localizacaoPadrao || null,
        requerLote: Boolean(dto.requerLote),
        requerValidade: Boolean(dto.requerValidade),
        vendidoPorPeso: Boolean(dto.vendidoPorPeso),
        cstIcms: dto.cstIcms || null,
        cstPis: dto.cstPis || null,
        cstCofins: dto.cstCofins || null,
        aliquotaIcms: num(dto.aliquotaIcms) ?? 0,
        aliquotaPis: num(dto.aliquotaPis) ?? 0,
        aliquotaCofins: num(dto.aliquotaCofins) ?? 0,
        cstIbsCbs: dto.cstIbsCbs || null,
        classTribIbsCbs: dto.classTribIbsCbs || null,
        aliquotaIbsUf: num(dto.aliquotaIbsUf) ?? 0,
        aliquotaIbsMun: num(dto.aliquotaIbsMun) ?? 0,
        aliquotaCbs: num(dto.aliquotaCbs) ?? 0,
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
    await this.validarCodigosBarras(tenantId, dto, id);
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
        codigoBarrasSecun: dto.codigoBarrasSecun ?? undefined,
        codigoBarrasCaixa: dto.codigoBarrasCaixa ?? undefined,
        gtinTributavel: dto.gtinTributavel ?? undefined,
        skuFornecedor: dto.skuFornecedor ?? undefined,
        referencia: dto.referencia ?? undefined,
        fabricante: dto.fabricante ?? undefined,
        descricaoCompleta: dto.descricaoCompleta ?? undefined,
        descricaoFiscal: dto.descricaoFiscal ?? undefined,
        ncm: dto.ncm ?? undefined,
        cest: dto.cest ?? undefined,
        exTipi: dto.exTipi ?? undefined,
        codigoBeneficioFiscal: dto.codigoBeneficioFiscal ?? undefined,
        generoItem: dto.generoItem ?? undefined,
        cfop: dto.cfop ?? undefined,
        categoria: dto.categoria ?? undefined,
        grupo: dto.grupo ?? undefined,
        subgrupo: dto.subgrupo ?? undefined,
        marca: dto.marca ?? undefined,
        classificacao: dto.classificacao ?? undefined,
        tipoCaixaria: dto.tipoCaixaria ?? undefined,
        pesoCaixaria: num(dto.pesoCaixaria),
        pesoLiquido: num(dto.pesoLiquido),
        pesoBruto: num(dto.pesoBruto),
        alturaCm: num(dto.alturaCm),
        larguraCm: num(dto.larguraCm),
        comprimentoCm: num(dto.comprimentoCm),
        quantidadeEmbalagem: num(dto.quantidadeEmbalagem),
        multiploCompra: num(dto.multiploCompra),
        precoCompra: num(dto.precoCompra),
        precoVenda: num(dto.precoVenda),
        estoqueMinimo: num(dto.estoqueMinimo),
        estoqueMaximo: dto.estoqueMaximo === null ? null : num(dto.estoqueMaximo),
        estoqueSeguranca: num(dto.estoqueSeguranca),
        pontoReposicao: num(dto.pontoReposicao),
        leadTimeDias: dto.leadTimeDias ?? undefined,
        localizacaoPadrao: dto.localizacaoPadrao ?? undefined,
        requerLote: dto.requerLote ?? undefined,
        requerValidade: dto.requerValidade ?? undefined,
        vendidoPorPeso: dto.vendidoPorPeso ?? undefined,
        cstIcms: dto.cstIcms ?? undefined,
        cstPis: dto.cstPis ?? undefined,
        cstCofins: dto.cstCofins ?? undefined,
        aliquotaIcms: num(dto.aliquotaIcms),
        aliquotaPis: num(dto.aliquotaPis),
        aliquotaCofins: num(dto.aliquotaCofins),
        cstIbsCbs: dto.cstIbsCbs ?? undefined,
        classTribIbsCbs: dto.classTribIbsCbs ?? undefined,
        aliquotaIbsUf: num(dto.aliquotaIbsUf),
        aliquotaIbsMun: num(dto.aliquotaIbsMun),
        aliquotaCbs: num(dto.aliquotaCbs),
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
            { codigoBarrasSecun: { contains: q } },
            { codigoBarrasCaixa: { contains: q } },
            { skuFornecedor: { contains: q, mode: 'insensitive' as any } },
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

  /** Impede que um leitor de código de barras encontre dois produtos diferentes. */
  private async validarCodigosBarras(tenantId: string, dto: any, ignorarId?: string) {
    const codigos = [dto.codigoBarras, dto.codigoBarrasSecun, dto.codigoBarrasCaixa, dto.gtinTributavel]
      .filter((v) => typeof v === 'string' && v.trim())
      .map((v: string) => v.replace(/\s/g, ''));
    if (new Set(codigos).size !== codigos.length) {
      throw new ConflictException('Os códigos de barras do produto devem ser diferentes entre si.');
    }
    if (!codigos.length) return;
    const conflito = await this.prisma.produto.findFirst({
      where: {
        tenantId,
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
        OR: codigos.flatMap((codigo) => [
          { codigoBarras: codigo }, { codigoBarrasSecun: codigo },
          { codigoBarrasCaixa: codigo }, { gtinTributavel: codigo },
        ]),
      },
      select: { codigo: true, descricao: true },
    });
    if (conflito) throw new ConflictException(`Código de barras já usado no produto ${conflito.codigo} — ${conflito.descricao}.`);
  }
}
