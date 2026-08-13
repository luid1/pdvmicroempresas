import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  NfeProvider,
  AutorizacaoResultado,
  AutorizacaoNfceResultado,
  CancelamentoResultado,
  CartaCorrecaoResultado,
} from './nfe-provider.interface';

/**
 * Provider REAL (SEFAZ direto ou gateway como Focus NF-e).
 *
 * ⚠️ STUB DE SEGURANÇA: enquanto o certificado A1 e a assinatura XML não estiverem
 * implementados/configurados, QUALQUER chamada aqui lança erro claro em vez de fingir
 * que transmitiu. Isso impede transmissão real acidental e deixa explícito o que falta.
 *
 * Config esperada quando este provider é selecionado (NFE_PROVIDER=focus|sefaz):
 *  - FOCUS_NFE_TOKEN / FOCUS_NFE_URL  (gateway Focus), OU
 *  - certificado A1 (model CertificadoDigital ativo) + assinatura própria (SEFAZ direto).
 */
@Injectable()
export class RealNfeProvider implements NfeProvider {
  readonly nome = process.env.NFE_PROVIDER || 'real';
  readonly simulacao = false;
  private readonly logger = new Logger(RealNfeProvider.name);

  private readonly focusUrl = process.env.FOCUS_NFE_URL || 'https://homologacao.focusnfe.com.br';
  private readonly focusToken = process.env.FOCUS_NFE_TOKEN || '';

  private naoConfigurado(): never {
    const msg =
      'Transmissão real ao SEFAZ não está configurada. ' +
      'Defina FOCUS_NFE_TOKEN (gateway) ou cadastre um CertificadoDigital A1 ativo, ' +
      'ou mantenha NFE_PROVIDER=mock para operar em simulação.';
    this.logger.error(`❌ ${msg}`);
    throw new BadRequestException(msg);
  }

  async autorizar(_nfe: any): Promise<AutorizacaoResultado> {
    if (!this.focusToken) this.naoConfigurado();
    // TODO F.2b: montar XML completo + assinar (A1) + POST /v2/nfe no gateway.
    this.naoConfigurado();
  }

  async autorizarNfce(nfe: any): Promise<AutorizacaoNfceResultado> {
    if (!this.focusToken) this.naoConfigurado();

    // Focus NF-e: POST assíncrono /v2/nfce?ref={ref}; depois poll GET /v2/nfce/{ref}.
    const ref = `nfce-${nfe.id}`;
    const auth = 'Basic ' + Buffer.from(`${this.focusToken}:`).toString('base64');
    const payload = this.montarPayloadFocusNfce(nfe);

    const post = await fetch(`${this.focusUrl}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (post.status >= 400 && post.status !== 422) {
      const t = await post.text();
      throw new BadRequestException(`Focus NFC-e falhou (HTTP ${post.status}): ${t}`);
    }

    // Poll até autorizar/rejeitar (Focus processa em fila; costuma resolver em segundos).
    let dados: any = await post.json().catch(() => ({}));
    for (let tentativa = 0; tentativa < 10 && dados?.status === 'processando_autorizacao'; tentativa++) {
      await new Promise((r) => setTimeout(r, 1500));
      const get = await fetch(`${this.focusUrl}/v2/nfce/${encodeURIComponent(ref)}`, {
        headers: { Authorization: auth },
      });
      dados = await get.json().catch(() => ({}));
    }

    if (dados?.status !== 'autorizado') {
      const motivo = dados?.mensagem_sefaz || dados?.mensagem || dados?.status || 'desconhecido';
      throw new BadRequestException(`NFC-e não autorizada pelo SEFAZ: ${motivo}`);
    }

    return {
      chaveAcesso: dados.chave_nfe,
      protocolo: dados.protocolo || dados.numero_protocolo || '',
      xml: dados.caminho_xml_nota_fiscal
        ? `${this.focusUrl}${dados.caminho_xml_nota_fiscal}`
        : '',
      qrCode: dados.qrcode_url || dados.qrcode || '',
      urlConsulta: dados.url_consulta_nf || dados.url || '',
      danfeUrl: dados.caminho_danfe ? `${this.focusUrl}${dados.caminho_danfe}` : undefined,
      simulacao: false,
    };
  }

  /**
   * Mapeia a NFe (modelo 65) persistida para o JSON esperado pelo Focus NF-e.
   * Campos mínimos; ajustar conforme cadastro fiscal do emitente/produtos.
   */
  private montarPayloadFocusNfce(nfe: any): Record<string, any> {
    return {
      cnpj_emitente: (nfe.emitenteCnpj || '').replace(/\D/g, ''),
      data_emissao: new Date().toISOString(),
      presenca_comprador: '1',
      modalidade_frete: '9',
      local_destino: '1',
      natureza_operacao: nfe.naturezaOperacao || 'Venda ao consumidor',
      cpf_destinatario: (nfe.destCnpjCpf || '').replace(/\D/g, '') || undefined,
      nome_destinatario: nfe.destRazaoSocial || undefined,
      valor_produtos: Number(nfe.valorProdutos),
      valor_desconto: Number(nfe.valorDesconto || 0),
      valor_total: Number(nfe.valorNfe),
      forma_pagamento: nfe.formaPagamento || '01',
      itens: (nfe.itens || []).map((it: any, i: number) => ({
        numero_item: i + 1,
        codigo_produto: it.codigo,
        descricao: it.descricao,
        cfop: it.cfop,
        unidade_comercial: it.unidade,
        quantidade_comercial: Number(it.quantidade),
        valor_unitario_comercial: Number(it.valorUnitario),
        valor_bruto: Number(it.valorTotal),
        unidade_tributavel: it.unidade,
        quantidade_tributavel: Number(it.quantidade),
        valor_unitario_tributavel: Number(it.valorUnitario),
        codigo_ncm: it.ncm,
        icms_origem: '0',
        icms_situacao_tributaria: it.cstCsosn,
        pis_situacao_tributaria: it.cstPis,
        cofins_situacao_tributaria: it.cstCofins,
      })),
    };
  }

  async cancelar(_chaveAcesso: string, _motivo: string): Promise<CancelamentoResultado> {
    if (!this.focusToken) this.naoConfigurado();
    // TODO F.2b: DELETE /v2/nfe/{ref} (Focus) ou evento 110111 assinado (SEFAZ direto).
    this.naoConfigurado();
  }

  async cartaCorrecao(
    _chaveAcesso: string,
    _sequencia: number,
    _texto: string,
  ): Promise<CartaCorrecaoResultado> {
    if (!this.focusToken) this.naoConfigurado();
    // TODO F.2b: evento 110110 assinado.
    this.naoConfigurado();
  }
}
