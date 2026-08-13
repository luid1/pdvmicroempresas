import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { validarCnpjCpf, validarIE, validarNcm, validarCfop, isCsosn, isCstIcms } from '../../common/utils/fiscal-validators.util';

/** Regimes tributários suportados no cálculo. */
export type RegimeTributario = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

/**
 * Alíquotas de PIS/COFINS por apuração.
 *  - cumulativo (Lucro Presumido): 0,65% / 3,00%
 *  - não-cumulativo (Lucro Real): 1,65% / 7,60%
 *  - Simples Nacional: recolhido dentro do DAS → 0 destacado na nota.
 */
const PIS_COFINS = {
  CUMULATIVO: { pis: 0.65, cofins: 3.0 },
  NAO_CUMULATIVO: { pis: 1.65, cofins: 7.6 },
} as const;

/**
 * Motor de Regras Fiscais e Tributárias.
 *
 * Responsável por:
 *  1. Resolver a regra fiscal aplicável a um item (matriz por NCM/UF/operação).
 *  2. Calcular CFOP, CST/CSOSN, bases e valores de ICMS, ICMS-ST, IPI, PIS e COFINS.
 *  3. Rodar o checklist anti-erro antes do faturamento.
 *
 * Modo de teste: os números são calculados de verdade, mas nada é transmitido à SEFAZ.
 */

export interface ImpostoItem {
  cfop: string;
  cstCsosn: string;
  origemProd: string;
  // ICMS
  baseCalcIcms: number;
  aliquotaIcms: number;
  valorIcms: number;
  // ICMS-ST
  baseCalcIcmsSt: number;
  valorIcmsSt: number;
  // FCP (Fundo de Combate à Pobreza)
  baseCalcFcp: number;
  aliquotaFcp: number;
  valorFcp: number;
  valorFcpSt: number;
  // IPI
  cstIpi: string | null;
  aliquotaIpi: number;
  valorIpi: number;
  // PIS
  cstPis: string;
  baseCalcPis: number;
  aliquotaPis: number;
  valorPis: number;
  // COFINS
  cstCofins: string;
  baseCalcCofins: number;
  aliquotaCofins: number;
  valorCofins: number;
  // DIFAL
  valorDifal: number;
  // Origem da regra (para auditoria/preview)
  regraId: string | null;
  regraDescricao: string;
  // Contexto tributário aplicado (auditoria)
  regime: RegimeTributario;
  apuracaoPisCofins: 'CUMULATIVO' | 'NAO_CUMULATIVO' | 'SIMPLES';
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (v: number, aliq: number) => r2((Number(v) || 0) * (Number(aliq) || 0) / 100);

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(private prisma: PrismaService) {}

  /** Normaliza o texto do regime da filial para o enum interno (tolera "SIMPLES"). */
  private normalizarRegime(valor: unknown): RegimeTributario {
    const v = String(valor ?? '').toUpperCase();
    if (v.includes('REAL')) return 'LUCRO_REAL';
    if (v.includes('PRESUMIDO')) return 'LUCRO_PRESUMIDO';
    return 'SIMPLES_NACIONAL';
  }

  // ─────────────────────────────────────────
  // 1. RESOLUÇÃO DA REGRA (matriz fiscal)
  // ─────────────────────────────────────────

  /**
   * Encontra a melhor RegraFiscal para o contexto. Match por especificidade:
   * NCM exato > NCM prefixo > curinga; UF destino específica > curinga;
   * desempate por `prioridade` (maior primeiro).
   */
  async resolverRegra(
    tenantId: string,
    ctx: { ncm?: string; ufDestino?: string; tipoOperacao?: string; consumidorFinal?: boolean },
  ) {
    const tipoOperacao = ctx.tipoOperacao || 'VENDA';
    const regras = await this.prisma.regraFiscal.findMany({
      where: { tenantId, ativo: true, tipoOperacao },
    });

    const candidatas = regras
      .map((rg) => {
        let score = 0;
        // NCM
        if (rg.ncm) {
          if (!ctx.ncm) return null;
          if (rg.ncm === ctx.ncm) score += 100;
          else if (ctx.ncm.startsWith(rg.ncm)) score += 50 + rg.ncm.length;
          else return null;
        }
        // UF destino
        if (rg.ufDestino) {
          if (rg.ufDestino !== ctx.ufDestino) return null;
          score += 30;
        }
        // Consumidor final
        if (rg.consumidorFinal !== null && rg.consumidorFinal !== undefined) {
          if (rg.consumidorFinal !== !!ctx.consumidorFinal) return null;
          score += 10;
        }
        score += rg.prioridade;
        return { rg, score };
      })
      .filter(Boolean) as { rg: any; score: number }[];

    candidatas.sort((a, b) => b.score - a.score);
    return candidatas[0]?.rg || null;
  }

  // ─────────────────────────────────────────
  // 2. CÁLCULO DE IMPOSTOS (por item)
  // ─────────────────────────────────────────

  /**
   * Calcula os impostos de um item. Usa a RegraFiscal se houver; senão cai para
   * as alíquotas/CST cadastrados no próprio produto (fallback seguro).
   */
  calcularItem(params: {
    valorItem: number;           // valor da mercadoria (qtd × unit − desconto)
    interestadual: boolean;
    consumidorFinal: boolean;
    tipoOperacao: string;        // VENDA, DEVOLUCAO...
    regime: RegimeTributario;    // regime da filial emitente
    regra: any | null;
    produto: { ncm: string; cfop?: string | null; origem?: string; cstIcms?: string | null;
      aliquotaIcms?: any; aliquotaPis?: any; aliquotaCofins?: any; cstPis?: string | null; cstCofins?: string | null };
  }): ImpostoItem {
    const { valorItem, interestadual, consumidorFinal, regra, produto, tipoOperacao, regime } = params;
    const dev = tipoOperacao === 'DEVOLUCAO';
    const simples = regime === 'SIMPLES_NACIONAL';

    // ---- CFOP ----
    let cfop: string;
    if (regra) {
      cfop = interestadual ? regra.cfopInterestadual : regra.cfopInterno;
    } else if (dev) {
      cfop = interestadual ? '6202' : '5202'; // devolução de venda
    } else {
      cfop = produto.cfop || (interestadual ? '6102' : '5102');
    }

    // ---- ICMS: CSOSN (Simples) × CST (Normal) ----
    // origem: 0=nacional ... 8=importado. Da regra, ou do produto (enum NACIONAL_0 → "0").
    const origemProd = String(regra?.origemProd ?? produto.origem ?? '0').replace(/\D/g, '').slice(-1) || '0';
    // Default coerente com o regime: Simples usa CSOSN 102 (sem crédito); Normal usa CST 00 (tributado).
    const defaultCst = simples ? '102' : '00';
    let cstCsosn = String(regra?.cstIcms ?? produto.cstIcms ?? defaultCst);
    // Coerência regime × código: no Simples só CSOSN; no Normal só CST. Corrige mismatch óbvio.
    if (simples && isCstIcms(cstCsosn) && !isCsosn(cstCsosn)) cstCsosn = '102';
    if (!simples && isCsosn(cstCsosn)) cstCsosn = '00';

    const aliquotaIcms = Number(regra?.aliquotaIcms ?? produto.aliquotaIcms ?? 0);
    const reducao = Number(regra?.reducaoBaseIcms ?? 0);
    const baseCalcIcmsBruta = r2(valorItem * (1 - reducao / 100));
    // ICMS destacado: no Simples só CSOSN com crédito (101/201) destacam "por dentro";
    // no Normal, CSTs tributados (00/10/20/70/90). Isento/ST-tributado anteriormente → 0.
    const icmsDestacado = simples
      ? ['101', '201'].includes(cstCsosn)
      : ['00', '10', '20', '70', '90'].includes(cstCsosn.slice(-2));
    const baseCalcIcms = icmsDestacado ? baseCalcIcmsBruta : 0;
    const valorIcms = icmsDestacado ? pct(baseCalcIcms, aliquotaIcms) : 0;

    // ---- ICMS-ST ----
    let baseCalcIcmsSt = 0;
    let valorIcmsSt = 0;
    if (regra?.temSt) {
      const mva = Number(regra.mvaSt || 0);
      const aliqSt = Number(regra.aliquotaIcmsSt || 0);
      baseCalcIcmsSt = r2(valorItem * (1 + mva / 100));
      valorIcmsSt = Math.max(0, r2(pct(baseCalcIcmsSt, aliqSt) - valorIcms));
    }

    // ---- FCP (Fundo de Combate à Pobreza) ----
    // Incide sobre a base do ICMS próprio (quando destacado) e/ou sobre a base da ST.
    const aliquotaFcp = Number(regra?.aliquotaFcp ?? 0);
    const aliquotaFcpSt = Number(regra?.aliquotaFcpSt ?? 0);
    const baseCalcFcp = icmsDestacado ? baseCalcIcms : 0;
    const valorFcp = aliquotaFcp > 0 && baseCalcFcp > 0 ? pct(baseCalcFcp, aliquotaFcp) : 0;
    const valorFcpSt = aliquotaFcpSt > 0 && baseCalcIcmsSt > 0 ? pct(baseCalcIcmsSt, aliquotaFcpSt) : 0;

    // ---- IPI ----
    const cstIpi = regra?.cstIpi ?? null;
    const aliquotaIpi = Number(regra?.aliquotaIpi ?? 0);
    const valorIpi = pct(valorItem, aliquotaIpi);

    // ---- PIS / COFINS: cumulativo × não-cumulativo por regime ----
    let apuracaoPisCofins: 'CUMULATIVO' | 'NAO_CUMULATIVO' | 'SIMPLES';
    let cstPis: string;
    let cstCofins: string;
    let aliquotaPis: number;
    let aliquotaCofins: number;
    if (simples) {
      // Recolhido no DAS → não destaca na nota (CST 49 / alíquota 0).
      apuracaoPisCofins = 'SIMPLES';
      cstPis = regra?.cstPis ?? produto.cstPis ?? '49';
      cstCofins = regra?.cstCofins ?? produto.cstCofins ?? '49';
      aliquotaPis = 0;
      aliquotaCofins = 0;
    } else {
      // Presumido = cumulativo; Real = não-cumulativo. Flag da regra pode forçar.
      const cumulativo = regra?.pisCumulativo != null
        ? !!regra.pisCumulativo
        : regime === 'LUCRO_PRESUMIDO';
      apuracaoPisCofins = cumulativo ? 'CUMULATIVO' : 'NAO_CUMULATIVO';
      const tabela = cumulativo ? PIS_COFINS.CUMULATIVO : PIS_COFINS.NAO_CUMULATIVO;
      cstPis = regra?.cstPis ?? produto.cstPis ?? '01';
      cstCofins = regra?.cstCofins ?? produto.cstCofins ?? '01';
      // Se a regra/produto trouxer alíquota explícita (>0), respeita; senão usa a do regime.
      aliquotaPis = Number(regra?.aliquotaPis ?? produto.aliquotaPis ?? 0) || tabela.pis;
      aliquotaCofins = Number(regra?.aliquotaCofins ?? produto.aliquotaCofins ?? 0) || tabela.cofins;
    }
    const valorPis = pct(valorItem, aliquotaPis);
    const valorCofins = pct(valorItem, aliquotaCofins);

    // ---- DIFAL (consumidor final, interestadual) ----
    let valorDifal = 0;
    if (regra?.temDifal && interestadual && consumidorFinal) {
      // diferença simplificada: (alíq interna destino − interestadual) sobre a base
      const aliqInterna = aliquotaIcms || 18;
      const aliqInter = 12;
      valorDifal = Math.max(0, pct(baseCalcIcmsBruta, aliqInterna - aliqInter));
    }

    return {
      cfop,
      cstCsosn,
      origemProd,
      baseCalcIcms,
      aliquotaIcms,
      valorIcms,
      baseCalcIcmsSt,
      valorIcmsSt,
      baseCalcFcp,
      aliquotaFcp,
      valorFcp,
      valorFcpSt,
      cstIpi,
      aliquotaIpi,
      valorIpi,
      cstPis,
      baseCalcPis: valorItem,
      aliquotaPis,
      valorPis,
      cstCofins,
      baseCalcCofins: valorItem,
      aliquotaCofins,
      valorCofins,
      valorDifal,
      regraId: regra?.id || null,
      regraDescricao: regra?.descricao || 'Padrão (produto)',
      regime,
      apuracaoPisCofins,
    };
  }

  /**
   * Calcula os impostos de TODOS os itens de um pedido já carregado (com cliente,
   * itens→produto e filialOrigem). Devolve itens enriquecidos + totais consolidados.
   */
  async calcularPedido(
    tenantId: string,
    pedido: any,
    opts: { tipoOperacao?: string } = {},
  ) {
    const tipoOperacao = opts.tipoOperacao || 'VENDA';
    const ufOrigem = (pedido.filialOrigem?.endereco as any)?.uf || 'SP';
    const ufDestino = (pedido.cliente?.enderecoJson as any)?.uf || ufOrigem;
    const interestadual = ufOrigem !== ufDestino;
    // Consumidor final = cliente sem IE (não contribuinte)
    const consumidorFinal = !pedido.cliente?.ie || pedido.cliente?.ie?.toUpperCase() === 'ISENTO';
    // Regime da filial emitente (define CST×CSOSN e apuração de PIS/COFINS)
    const regime = this.normalizarRegime(pedido.filialOrigem?.regimeTributario);

    const itens = [] as any[];
    for (const item of pedido.itens) {
      const valorItem = Number(item.valorTotal);
      const regra = await this.resolverRegra(tenantId, {
        ncm: item.produto?.ncm,
        ufDestino,
        tipoOperacao,
        consumidorFinal,
      });
      const imp = this.calcularItem({
        valorItem,
        interestadual,
        consumidorFinal,
        tipoOperacao,
        regime,
        regra,
        produto: item.produto,
      });
      itens.push({ item, imposto: imp });
    }

    const totais = itens.reduce(
      (acc, { imposto }) => ({
        baseIcms: r2(acc.baseIcms + imposto.baseCalcIcms),
        valorIcms: r2(acc.valorIcms + imposto.valorIcms),
        valorIcmsSt: r2(acc.valorIcmsSt + imposto.valorIcmsSt),
        valorFcp: r2(acc.valorFcp + imposto.valorFcp + imposto.valorFcpSt),
        valorIpi: r2(acc.valorIpi + imposto.valorIpi),
        valorPis: r2(acc.valorPis + imposto.valorPis),
        valorCofins: r2(acc.valorCofins + imposto.valorCofins),
        valorDifal: r2(acc.valorDifal + imposto.valorDifal),
      }),
      { baseIcms: 0, valorIcms: 0, valorIcmsSt: 0, valorFcp: 0, valorIpi: 0, valorPis: 0, valorCofins: 0, valorDifal: 0 },
    );

    return { itens, totais, contexto: { ufOrigem, ufDestino, interestadual, consumidorFinal, regime } };
  }

  // ─────────────────────────────────────────
  // 3. VALIDAÇÃO ANTI-ERRO (checklist pré-faturamento)
  // ─────────────────────────────────────────

  /**
   * Roda o checklist antes de faturar. Devolve uma lista de checagens; cada uma
   * com ok=true/false e severidade (BLOQUEIO impede faturar, AVISO só alerta).
   */
  async validarFaturamento(tenantId: string, pedidoId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId },
      include: {
        cliente: true,
        filialOrigem: true,
        itens: { include: { produto: true } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');

    const checks: { id: string; label: string; ok: boolean; severidade: 'BLOQUEIO' | 'AVISO'; detalhe?: string }[] = [];
    const add = (id: string, label: string, ok: boolean, severidade: 'BLOQUEIO' | 'AVISO', detalhe?: string) =>
      checks.push({ id, label, ok, severidade, detalhe });

    // a) Status do pedido
    add('status', 'Pedido liberado para faturamento', ['SEPARADO', 'CONFIRMADO'].includes(pedido.status), 'BLOQUEIO',
      `Status atual: ${pedido.status}`);

    // b) Cliente
    const cli = pedido.cliente;
    add('cliente', 'Cliente vinculado ao pedido', !!cli, 'BLOQUEIO');
    add('cliente-ativo', 'Cliente ativo', !!cli?.ativo, 'BLOQUEIO');
    // CNPJ/CPF com dígito verificador (evita rejeição SEFAZ por documento inválido).
    const docOk = validarCnpjCpf(cli?.cnpjCpf);
    add('cnpj', 'CNPJ/CPF do cliente válido (dígito verificador)', docOk, 'BLOQUEIO',
      cli?.cnpjCpf ? (docOk ? undefined : 'dígito verificador inválido') : 'não informado');
    const ufCli = (cli?.enderecoJson as any)?.uf;
    const endOk = !!ufCli && !!(cli?.enderecoJson as any)?.cidade;
    add('endereco', 'Endereço do cliente completo (cidade/UF)', endOk, 'BLOQUEIO');
    const pj = cli?.tipo === 'PJ';
    add('ie', 'Inscrição Estadual informada (ou ISENTO)', !pj || !!cli?.ie, 'AVISO',
      cli?.ie || 'sem IE — será tratado como consumidor final');
    // Validação de IE por UF (só quando informada e não isenta) — barata, evita rejeição.
    if (cli?.ie && cli.ie.toUpperCase() !== 'ISENTO') {
      const ieOk = validarIE(cli.ie, ufCli);
      add('ie-valida', 'Inscrição Estadual válida para a UF', ieOk, 'AVISO',
        ieOk ? undefined : `IE ${cli.ie} não confere com a UF ${ufCli || '?'}`);
    }
    add('sintegra', 'Cadastro validado no Sintegra/CCC', !!cli?.sintegraOk, 'AVISO',
      cli?.sintegraOk ? 'validado' : 'não validado (modo teste)');

    // c) Crédito
    add('credito', 'Sem bloqueio de crédito', !pedido.bloqueioCredito, 'BLOQUEIO', pedido.motivoBloqueio || undefined);

    // d) Itens e estoque
    add('itens', 'Pedido possui itens', pedido.itens.length > 0, 'BLOQUEIO');
    for (const item of pedido.itens) {
      if (item.cortado) continue;
      const saldos = await this.prisma.estoqueSaldo.findMany({
        where: { tenantId, filialId: pedido.filialOrigemId, produtoId: item.produtoId },
      });
      const disponivel = saldos.reduce((s, sd) => s + Number(sd.quantidade) - Number(sd.quantidadeReservada || 0), 0);
      // o pedido aprovado já reservou; basta o físico cobrir a quantidade
      const fisico = saldos.reduce((s, sd) => s + Number(sd.quantidade), 0);
      // BLOQUEIO: sem estoque físico suficiente, não fatura.
      add(`estoque-${item.id}`, `Estoque de ${item.descricao}`, fisico >= Number(item.quantidade), 'BLOQUEIO',
        `físico ${fisico} · necessário ${item.quantidade}` + (disponivel < 0 ? ' (disponível negativo — a comprar)' : ''));
    }

    // e) NCM dos produtos (formato de 8 dígitos)
    const semNcm = pedido.itens.filter((i) => !validarNcm(i.produto?.ncm));
    add('ncm', 'Todos os produtos com NCM válido (8 dígitos)', semNcm.length === 0, 'BLOQUEIO',
      semNcm.length ? `${semNcm.length} produto(s) com NCM ausente/inválido` : undefined);

    // e.2) CFOP dos produtos (quando cadastrado no produto) — formato 4 dígitos.
    const cfopInvalidos = pedido.itens.filter((i) => i.produto?.cfop && !validarCfop(i.produto.cfop));
    if (cfopInvalidos.length) {
      add('cfop', 'CFOP dos produtos em formato válido', false, 'AVISO',
        `${cfopInvalidos.length} produto(s) com CFOP fora do padrão (4 dígitos)`);
    }

    // f) Emitente (filial): CNPJ presente E com dígito verificador válido.
    const emitCnpj = pedido.filialOrigem?.cnpj;
    add('emitente', 'Filial emitente com CNPJ válido', validarCnpjCpf(emitCnpj), 'BLOQUEIO',
      emitCnpj ? (validarCnpjCpf(emitCnpj) ? undefined : 'CNPJ da filial com dígito inválido') : 'filial sem CNPJ');
    // f.2) Regime tributário da filial (define o cálculo de imposto).
    const regimeFilial = this.normalizarRegime(pedido.filialOrigem?.regimeTributario);
    add('regime', 'Regime tributário da filial definido', !!pedido.filialOrigem?.regimeTributario, 'AVISO',
      `apurando como ${regimeFilial.replace('_', ' ')}`);

    const bloqueios = checks.filter((c) => !c.ok && c.severidade === 'BLOQUEIO');
    const avisos = checks.filter((c) => !c.ok && c.severidade === 'AVISO');
    return {
      pedidoId,
      podeFaturar: bloqueios.length === 0,
      checks,
      bloqueios: bloqueios.length,
      avisos: avisos.length,
    };
  }

  // ─────────────────────────────────────────
  // 4. CRUD da MATRIZ FISCAL
  // ─────────────────────────────────────────

  listarRegras(tenantId: string) {
    return this.prisma.regraFiscal.findMany({
      where: { tenantId },
      orderBy: [{ ativo: 'desc' }, { prioridade: 'desc' }, { createdAt: 'asc' }],
    });
  }

  criarRegra(tenantId: string, dto: any) {
    return this.prisma.regraFiscal.create({ data: { ...this.sanitize(dto), tenantId } });
  }

  async atualizarRegra(tenantId: string, id: string, dto: any) {
    const existe = await this.prisma.regraFiscal.findFirst({ where: { id, tenantId } });
    if (!existe) throw new NotFoundException('Regra fiscal não encontrada.');
    return this.prisma.regraFiscal.update({ where: { id }, data: this.sanitize(dto) });
  }

  async removerRegra(tenantId: string, id: string) {
    const existe = await this.prisma.regraFiscal.findFirst({ where: { id, tenantId } });
    if (!existe) throw new NotFoundException('Regra fiscal não encontrada.');
    await this.prisma.regraFiscal.delete({ where: { id } });
    return { ok: true };
  }

  private sanitize(dto: any) {
    const decimais = ['aliquotaIcms', 'reducaoBaseIcms', 'mvaSt', 'aliquotaIcmsSt', 'aliquotaFcp', 'aliquotaFcpSt', 'aliquotaIpi', 'aliquotaPis', 'aliquotaCofins'];
    const out: any = { ...dto };
    delete out.id; delete out.tenantId; delete out.createdAt; delete out.updatedAt;
    for (const k of decimais) if (out[k] !== undefined) out[k] = Number(out[k]) || 0;
    if (out.prioridade !== undefined) out.prioridade = Number(out.prioridade) || 0;
    return out;
  }

  /**
   * Cria um conjunto de regras-padrão pra começar (FLV no Simples Nacional, SP).
   * Idempotente: só semeia se a matriz estiver vazia.
   */
  async seedPadrao(tenantId: string) {
    const qtd = await this.prisma.regraFiscal.count({ where: { tenantId } });
    if (qtd > 0) return { criadas: 0, jaExistiam: qtd };

    const regras = [
      {
        descricao: 'FLV — venda interna SP (Simples, isento ICMS)',
        ncm: null, ufDestino: 'SP', tipoOperacao: 'VENDA', consumidorFinal: null,
        cfopInterno: '5102', cfopInterestadual: '6102',
        cstIcms: '102', aliquotaIcms: 0, cstPis: '07', aliquotaPis: 0, cstCofins: '07', aliquotaCofins: 0,
        prioridade: 10,
      },
      {
        descricao: 'Venda interestadual (Simples)',
        ncm: null, ufDestino: null, tipoOperacao: 'VENDA', consumidorFinal: false,
        cfopInterno: '5102', cfopInterestadual: '6102',
        cstIcms: '102', aliquotaIcms: 0, cstPis: '07', aliquotaPis: 0, cstCofins: '07', aliquotaCofins: 0,
        prioridade: 5,
      },
      {
        descricao: 'Devolução de venda',
        ncm: null, ufDestino: null, tipoOperacao: 'DEVOLUCAO', consumidorFinal: null,
        cfopInterno: '5202', cfopInterestadual: '6202',
        cstIcms: '102', aliquotaIcms: 0, cstPis: '07', aliquotaPis: 0, cstCofins: '07', aliquotaCofins: 0,
        prioridade: 5,
      },
    ];
    await this.prisma.regraFiscal.createMany({ data: regras.map((r) => ({ ...r, tenantId })) });
    return { criadas: regras.length };
  }
}
