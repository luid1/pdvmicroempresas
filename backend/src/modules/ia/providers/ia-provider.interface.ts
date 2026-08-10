/**
 * Contrato de um provedor de LLM para o assistente "Lu".
 *
 * CAMADA AGNÓSTICA (mesmo padrão de TEF/NFC-e/Mercado Pago): a escolha do
 * provedor é feita por env (`IA_MODO`), então trocar Gemini por outro modelo
 * no futuro é implementar esta interface — sem mexer no resto do sistema.
 *
 * READ-ONLY: um provider só transforma texto em texto. Ele NUNCA acessa o
 * banco nem altera dados — quem busca os números da loja é o IaService, sempre
 * travado no tenantId do usuário logado.
 */
export interface IaProvider {
  /** Nome curto do provider (para log/telemetria). */
  nome(): string;

  /**
   * Gera uma resposta em texto a partir de uma instrução de sistema (persona)
   * e um prompt do usuário.
   *
   * `historico` (opcional) traz os turnos anteriores da conversa para dar
   * memória curta ao chat (v0.3). O `prompt` é sempre a mensagem ATUAL do
   * usuário; o histórico contém apenas as trocas que vieram antes.
   */
  gerar(input: {
    sistema: string;
    prompt: string;
    maxTokens?: number;
    temperatura?: number;
    historico?: { autor: 'user' | 'lu'; texto: string }[];
    /** Quando true, pede ao modelo uma resposta em JSON puro (classificação/extração). */
    json?: boolean;
  }): Promise<string>;
}
