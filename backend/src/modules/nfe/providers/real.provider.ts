import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  NfeProvider, AutorizacaoResultado, AutorizacaoNfceResultado,
  CancelamentoResultado, CartaCorrecaoResultado,
  InutilizacaoResultado,
} from './nfe-provider.interface';

type Documento = 'nfe' | 'nfce';

/** Integração real com o gateway Focus NFe, que assina e comunica com a SEFAZ. */
@Injectable()
export class RealNfeProvider implements NfeProvider {
  readonly nome = 'focus';
  readonly simulacao = false;
  private readonly logger = new Logger(RealNfeProvider.name);
  private readonly token = process.env.FOCUS_NFE_TOKEN || '';
  private readonly ambiente = (process.env.NFE_AMBIENTE || 'homologacao').toLowerCase();
  private readonly baseUrl = (process.env.FOCUS_NFE_URL ||
    (this.ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br')).replace(/\/$/, '');

  private validarConfiguracao() {
    if (!this.token) throw new BadRequestException('FOCUS_NFE_TOKEN não configurado. A emissão real permanece bloqueada.');
    if (this.baseUrl.includes('api.focusnfe.com.br') && this.ambiente !== 'producao') {
      throw new BadRequestException('Configuração fiscal inconsistente: URL de produção com NFE_AMBIENTE diferente de producao.');
    }
  }

  private referencia(nfe: any, documento: Documento) {
    return `${documento}-${nfe.id}`;
  }

  private async requisitar(path: string, init: RequestInit = {}, aceitos = [200, 201, 202]): Promise<any> {
    this.validarConfiguracao();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.token}:`).toString('base64')}`,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });
      const texto = await response.text();
      let dados: any = {};
      try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { mensagem: texto.slice(0, 1000) }; }
      if (!aceitos.includes(response.status)) {
        const detalhe = dados?.mensagem_sefaz || dados?.mensagem || dados?.erros?.map((e: any) => e.mensagem || e).join('; ') || `HTTP ${response.status}`;
        throw new BadRequestException(`Focus NFe: ${detalhe}`);
      }
      return dados;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new ServiceUnavailableException('Tempo esgotado ao comunicar com a SEFAZ. Consulte a nota antes de reenviar.');
      throw e;
    } finally { clearTimeout(timeout); }
  }

  private async aguardar(documento: Documento, ref: string, inicial: any): Promise<any> {
    let dados = inicial;
    const pendentes = ['processando_autorizacao', 'processando', 'autorizando'];
    for (let tentativa = 0; tentativa < 20 && pendentes.includes(String(dados?.status || '').toLowerCase()); tentativa++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      dados = await this.requisitar(`/v2/${documento}/${encodeURIComponent(ref)}?completa=1`);
    }
    if (String(dados?.status).toLowerCase() !== 'autorizado') {
      const motivo = dados?.mensagem_sefaz || dados?.mensagem || dados?.status || 'retorno desconhecido';
      throw new BadRequestException(`${documento.toUpperCase()} não autorizada: ${motivo}`);
    }
    return dados;
  }

  private arquivoUrl(caminho?: string) {
    if (!caminho) return '';
    return caminho.startsWith('http') ? caminho : `${this.baseUrl}${caminho.startsWith('/') ? '' : '/'}${caminho}`;
  }

  private async baixarXml(caminho?: string) {
    const url = this.arquivoUrl(caminho);
    if (!url) return '';
    try {
      const response = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`${this.token}:`).toString('base64')}` } });
      return response.ok ? await response.text() : url;
    } catch { return url; }
  }

  async autorizar(nfe: any): Promise<AutorizacaoResultado> {
    const ref = this.referencia(nfe, 'nfe');
    this.logger.log(`Transmitindo NF-e ${nfe.serie}/${nfe.numero} (${this.ambiente})`);
    const inicial = await this.requisitar(`/v2/nfe?ref=${encodeURIComponent(ref)}`, { method: 'POST', body: JSON.stringify(this.montarPayload(nfe, false)) });
    const dados = await this.aguardar('nfe', ref, inicial);
    return {
      chaveAcesso: dados.chave_nfe,
      protocolo: dados.protocolo || dados.numero_protocolo || '',
      xml: await this.baixarXml(dados.caminho_xml_nota_fiscal || dados.caminho_xml),
      danfeUrl: this.arquivoUrl(dados.caminho_danfe || dados.caminho_pdf),
      simulacao: false,
    };
  }

  async autorizarNfce(nfe: any): Promise<AutorizacaoNfceResultado> {
    const ref = this.referencia(nfe, 'nfce');
    const inicial = await this.requisitar(`/v2/nfce?ref=${encodeURIComponent(ref)}&completa=1`, { method: 'POST', body: JSON.stringify(this.montarPayload(nfe, true)) });
    const dados = await this.aguardar('nfce', ref, inicial);
    return {
      chaveAcesso: dados.chave_nfe, protocolo: dados.protocolo || dados.numero_protocolo || '',
      xml: await this.baixarXml(dados.caminho_xml_nota_fiscal || dados.caminho_xml),
      qrCode: dados.qrcode_url || dados.qrcode || '', urlConsulta: dados.url_consulta_nf || dados.url_consulta || '',
      danfeUrl: this.arquivoUrl(dados.caminho_danfe || dados.caminho_pdf), simulacao: false,
    };
  }

  private montarPayload(nfe: any, nfce: boolean): Record<string, any> {
    const filial = nfe.filial || {};
    const emit = this.endereco(filial.endereco);
    const dest = this.endereco(nfe.destEnderecoJson);
    const docDest = String(nfe.destCnpjCpf || '').replace(/\D/g, '');
    const pagamentos = [{ forma_pagamento: this.formaPagamento(nfe.formaPagamento), valor_pagamento: Number(nfe.valorNfe || 0) }];
    return this.limpar({
      natureza_operacao: nfe.naturezaOperacao || (nfce ? 'VENDA AO CONSUMIDOR' : 'VENDA DE MERCADORIAS'),
      data_emissao: this.dataIsoBrasil(), data_entrada_saida: this.dataIsoBrasil(), tipo_documento: nfe.tipoOperacao === 'ENTRADA' ? 0 : 1,
      finalidade_emissao: Number(nfe.finalidade || 1), consumidor_final: nfce ? 1 : Number(nfe.consumidorFinal || 0),
      presenca_comprador: nfce ? 1 : Number(nfe.presencaComprador || 0), local_destino: this.localDestino(emit.uf, dest.uf),
      modalidade_frete: Number(nfe.tipoFrete || 9), serie: String(nfe.serie), numero: String(nfe.numero),
      cnpj_emitente: String(nfe.emitenteCnpj || filial.cnpj || '').replace(/\D/g, ''), nome_emitente: filial.nome,
      inscricao_estadual_emitente: filial.ie, regime_tributario_emitente: Number(filial.crt || 1),
      logradouro_emitente: emit.logradouro, numero_emitente: emit.numero, complemento_emitente: emit.complemento,
      bairro_emitente: emit.bairro, municipio_emitente: emit.municipio, codigo_municipio_emitente: emit.codigoMunicipio,
      uf_emitente: emit.uf, cep_emitente: emit.cep, telefone_emitente: emit.telefone,
      ...(docDest.length === 11 ? { cpf_destinatario: docDest } : docDest.length === 14 ? { cnpj_destinatario: docDest } : {}),
      nome_destinatario: nfe.destRazaoSocial, indicador_inscricao_estadual_destinatario: Number(nfe.indicadorIeDestinatario || 9),
      inscricao_estadual_destinatario: nfe.destInscricaoEstadual,
      logradouro_destinatario: dest.logradouro, numero_destinatario: dest.numero, complemento_destinatario: dest.complemento,
      bairro_destinatario: dest.bairro, municipio_destinatario: dest.municipio, codigo_municipio_destinatario: dest.codigoMunicipio,
      uf_destinatario: dest.uf, cep_destinatario: dest.cep, telefone_destinatario: dest.telefone, pais_destinatario: 'Brasil',
      valor_produtos: Number(nfe.valorProdutos || 0), valor_frete: Number(nfe.valorFrete || 0), valor_desconto: Number(nfe.valorDesconto || 0),
      valor_total: Number(nfe.valorNfe || 0), formas_pagamento: pagamentos,
      items: (nfe.itens || []).map((item: any, indice: number) => this.item(item, indice, Number(filial.crt || 1) !== 1)),
    });
  }

  private item(it: any, indice: number, regimeRegular: boolean) {
    const p = it.produto || {};
    const exigeReforma = regimeRegular && new Date() >= new Date('2026-08-03T00:00:00-03:00');
    if (exigeReforma && (!p.cstIbsCbs || !p.classTribIbsCbs)) {
      throw new BadRequestException(`Produto ${it.codigo} sem CST IBS/CBS ou cClassTrib, obrigatórios para o regime regular.`);
    }
    const baseIbsCbs = Number(it.valorTotal || 0) - Number(it.valorDesconto || 0);
    const aliqIbsUf = Number(p.aliquotaIbsUf || 0);
    const aliqIbsMun = Number(p.aliquotaIbsMun || 0);
    const aliqCbs = Number(p.aliquotaCbs || 0);
    return this.limpar({
      numero_item: indice + 1, codigo_produto: it.codigo, descricao: p.descricaoFiscal || it.descricao,
      codigo_ncm: String(it.ncm || '').replace(/\D/g, ''), codigo_cest: p.cest?.replace(/\D/g, ''), codigo_beneficio_fiscal: p.codigoBeneficioFiscal,
      cfop: String(it.cfop || '').replace(/\D/g, ''), unidade_comercial: it.unidade, quantidade_comercial: Number(it.quantidade),
      valor_unitario_comercial: Number(it.valorUnitario), valor_bruto: Number(it.valorTotal), valor_desconto: Number(it.valorDesconto || 0),
      codigo_barras_comercial: p.codigoBarras, unidade_tributavel: p.unidadeTributavel || it.unidade,
      quantidade_tributavel: Number(it.quantidade) * Number(p.fatorConversao || 1), valor_unitario_tributavel: Number(it.valorUnitario) / Number(p.fatorConversao || 1),
      codigo_barras_tributavel: p.gtinTributavel || p.codigoBarras,
      icms_origem: String(it.origemProd || '0'), icms_situacao_tributaria: String(it.cstCsosn || p.cstIcms || '102'),
      icms_base_calculo: Number(it.baseCalcIcms || 0), icms_aliquota: Number(it.aliquotaIcms || 0), icms_valor: Number(it.valorIcms || 0),
      fcp_base_calculo: Number(it.baseCalcFcp || 0), fcp_aliquota: Number(it.aliquotaFcp || 0), fcp_valor: Number(it.valorFcp || 0),
      pis_situacao_tributaria: String(it.cstPis || '07'), pis_base_calculo: Number(it.baseCalcPis || 0), pis_aliquota_porcentual: Number(it.aliquotaPis || 0), pis_valor: Number(it.valorPis || 0),
      cofins_situacao_tributaria: String(it.cstCofins || '07'), cofins_base_calculo: Number(it.baseCalcCofins || 0), cofins_aliquota_porcentual: Number(it.aliquotaCofins || 0), cofins_valor: Number(it.valorCofins || 0),
      ibs_cbs_situacao_tributaria: p.cstIbsCbs, ibs_cbs_classificacao_tributaria: p.classTribIbsCbs,
      ibs_cbs_base_calculo: exigeReforma ? baseIbsCbs : undefined,
      ibs_uf_aliquota: exigeReforma ? aliqIbsUf : undefined, ibs_uf_valor: exigeReforma ? this.r2(baseIbsCbs * aliqIbsUf / 100) : undefined,
      ibs_mun_aliquota: exigeReforma ? aliqIbsMun : undefined, ibs_mun_valor: exigeReforma ? this.r2(baseIbsCbs * aliqIbsMun / 100) : undefined,
      cbs_aliquota: exigeReforma ? aliqCbs : undefined, cbs_valor: exigeReforma ? this.r2(baseIbsCbs * aliqCbs / 100) : undefined,
      valor_total_item: regimeRegular ? this.r2(Number(it.valorTotal || 0)) : undefined,
    });
  }

  private endereco(json: any) {
    const e = typeof json === 'string' ? (() => { try { return JSON.parse(json); } catch { return {}; } })() : (json || {});
    return { logradouro: e.logradouro || e.rua, numero: e.numero, complemento: e.complemento, bairro: e.bairro,
      municipio: e.municipio || e.cidade, codigoMunicipio: e.codigoMunicipio || e.codigoIbge, uf: e.uf,
      cep: String(e.cep || '').replace(/\D/g, ''), telefone: String(e.telefone || '').replace(/\D/g, '') };
  }

  private formaPagamento(valor: string) {
    const mapa: Record<string, string> = { DINHEIRO: '01', CHEQUE: '02', CARTAO_CREDITO: '03', CARTAO_DEBITO: '04', CREDITO_LOJA: '05', VALE_ALIMENTACAO: '10', BOLETO: '15', PIX: '17', SEM_PAGAMENTO: '90' };
    return mapa[String(valor || '').toUpperCase()] || (/^\d{2}$/.test(valor || '') ? valor : '99');
  }
  private localDestino(origem?: string, destino?: string) { return !destino || !origem || origem === destino ? 1 : destino === 'EX' ? 3 : 2; }
  private dataIsoBrasil() { const d = new Date(); return new Date(d.getTime() - 3 * 3600000).toISOString().replace('Z', '-03:00'); }
  private limpar(obj: Record<string, any>) { return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')); }
  private r2(valor: number) { return Math.round((Number(valor) || 0) * 100) / 100; }

  async cancelar(_chave: string, motivo: string, nfe?: any): Promise<CancelamentoResultado> {
    if (!nfe?.id) throw new BadRequestException('Documento fiscal sem referência interna para cancelamento.');
    const documento: Documento = nfe.modelo === '65' ? 'nfce' : 'nfe';
    const dados = await this.requisitar(`/v2/${documento}/${encodeURIComponent(this.referencia(nfe, documento))}`, { method: 'DELETE', body: JSON.stringify({ justificativa: motivo }) });
    return { xml: await this.baixarXml(dados.caminho_xml_cancelamento || dados.caminho_xml), protocolo: dados.protocolo || dados.numero_protocolo, simulacao: false };
  }

  async cartaCorrecao(_chave: string, _sequencia: number, texto: string, nfe?: any): Promise<CartaCorrecaoResultado> {
    if (!nfe?.id || nfe.modelo === '65') throw new BadRequestException('Carta de correção é permitida somente para NF-e modelo 55 com referência interna.');
    const dados = await this.requisitar(`/v2/nfe/${encodeURIComponent(this.referencia(nfe, 'nfe'))}/carta_correcao`, { method: 'POST', body: JSON.stringify({ correcao: texto, data_evento: this.dataIsoBrasil() }) });
    return { xml: await this.baixarXml(dados.caminho_xml_carta_correcao || dados.caminho_xml), protocolo: dados.protocolo || dados.numero_protocolo || '', status: 'REGISTRADO', simulacao: false };
  }


  async inutilizar(dados: { cnpj: string; serie: string; numeroInicial: number; numeroFinal: number; justificativa: string; modelo?: '55' | '65' }): Promise<InutilizacaoResultado> {
    const documento: Documento = dados.modelo === '65' ? 'nfce' : 'nfe';
    const retorno = await this.requisitar(`/v2/${documento}/inutilizacao`, { method: 'POST', body: JSON.stringify({
      cnpj: dados.cnpj.replace(/\D/g, ''), serie: String(dados.serie), numero_inicial: String(dados.numeroInicial),
      numero_final: String(dados.numeroFinal), justificativa: dados.justificativa,
    }) });
    return { protocolo: retorno.protocolo || retorno.numero_protocolo, xml: await this.baixarXml(retorno.caminho_xml || retorno.xml), status: retorno.status || 'INUTILIZADO', simulacao: false };
  }
}
