/**
 * Abstração do provedor de transmissão de NF-e ao SEFAZ.
 *
 * A ideia é isolar TODO o ponto de contato com a autoridade fiscal atrás desta
 * interface. Hoje o sistema roda 100% em modo simulação (MockProvider); quando o
 * certificado A1 e a infraestrutura de assinatura estiverem disponíveis, basta
 * plugar um provider real (SEFAZ direto ou gateway como Focus NF-e) sem tocar na
 * regra de negócio do NFeService.
 *
 * Seleção por ambiente: process.env.NFE_PROVIDER ('mock' | 'focus' | 'sefaz').
 * Default = 'mock' — NUNCA transmite de verdade a menos que explicitamente configurado.
 */

export interface AutorizacaoResultado {
  chaveAcesso: string;
  protocolo: string;
  xml: string;
  danfeUrl: string;
  /** true quando o resultado veio da simulação (nenhuma transmissão real ocorreu). */
  simulacao: boolean;
}

export interface AutorizacaoNfceResultado {
  chaveAcesso: string;
  protocolo: string;
  xml: string;
  /** Payload textual do QR Code (NFC-e modelo 65). */
  qrCode: string;
  /** URL de consulta do consumidor (portal da SEFAZ). */
  urlConsulta: string;
  /** URL/path do DANFE NFC-e (cupom), quando disponível. */
  danfeUrl?: string;
  /** true quando o resultado veio da simulação (nenhuma transmissão real ocorreu). */
  simulacao: boolean;
}

export interface CancelamentoResultado {
  xml: string;
  protocolo?: string;
  simulacao: boolean;
}

export interface CartaCorrecaoResultado {
  xml: string;
  protocolo: string;
  status: string;
  simulacao: boolean;
}

export interface InutilizacaoResultado {
  protocolo?: string;
  xml: string;
  status: string;
  simulacao: boolean;
}

export interface NfeProvider {
  /** Nome curto do provider (mock/focus/sefaz) — para logs e auditoria. */
  readonly nome: string;
  /** true se este provider apenas simula (não transmite ao SEFAZ real). */
  readonly simulacao: boolean;

  /** Autoriza (transmite) a NF-e. Recebe a NF-e já persistida com itens carregados. */
  autorizar(nfe: any): Promise<AutorizacaoResultado>;

  /** Autoriza (transmite) uma NFC-e (modelo 65) ao SEFAZ. Retorna QR Code + URL de consulta. */
  autorizarNfce(nfe: any): Promise<AutorizacaoNfceResultado>;

  /** Cancela uma NF-e autorizada pela chave de acesso. */
  cancelar(chaveAcesso: string, motivo: string, nfe?: any): Promise<CancelamentoResultado>;

  /** Registra uma Carta de Correção Eletrônica. */
  cartaCorrecao(chaveAcesso: string, sequencia: number, texto: string, nfe?: any): Promise<CartaCorrecaoResultado>;

  /** Inutiliza uma faixa de numeração não utilizada. */
  inutilizar?(dados: { tenantId?: string; filialId?: string; cnpj: string; serie: string; numeroInicial: number; numeroFinal: number; justificativa: string; modelo?: '55' | '65' }): Promise<InutilizacaoResultado>;
}

export const NFE_PROVIDER = Symbol('NFE_PROVIDER');
