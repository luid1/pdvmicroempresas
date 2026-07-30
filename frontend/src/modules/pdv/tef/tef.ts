/**
 * Camada de TEF (Transferência Eletrônica de Fundos) plugável.
 *
 * A ideia é isolar o PDV de QUAL gerenciador de TEF está em uso. Hoje temos:
 *   - 'desligado'  → não há TEF; o operador usa maquininha avulsa (POS) e só
 *                    registra o valor no PDV. (padrão)
 *   - 'simulado'   → simula uma transação aprovada (para testar o fluxo da UI
 *                    sem hardware). Útil em homologação/demonstração.
 *   - 'paygo' / 'sitef' → stubs prontos para integrar o gerenciador real
 *                    (PayGo/Elgin ou SiTef/Software Express) quando você tiver
 *                    o contrato com a adquirente e o software instalado.
 *
 * Selecione o modo por variável de ambiente do Vite:
 *   VITE_TEF_MODO=desligado | simulado | paygo | sitef   (default: desligado)
 */

export type CanalPagamento = 'CREDITO' | 'DEBITO' | 'PIX';

export type TefRequisicao = {
  canal: CanalPagamento;
  valor: number;
  /** Parcelas (crédito). 1 = à vista. */
  parcelas?: number;
};

export type TefResultado = {
  aprovado: boolean;
  cancelado?: boolean;
  bandeira?: string;
  nsu?: string;
  autorizacao?: string;
  mensagem?: string;
};

export interface TefProvider {
  readonly nome: string;
  /** TEF de verdade (auto-envia valor à máquina) ou POS manual. */
  readonly integrado: boolean;
  disponivel(): Promise<boolean>;
  transacionar(req: TefRequisicao): Promise<TefResultado>;
  cancelar?(nsu: string, valor: number): Promise<TefResultado>;
}

/** Sem TEF: o PDV nunca dispara nada na máquina (usa POS manual). */
class DesligadoTefProvider implements TefProvider {
  readonly nome = 'Sem TEF (maquininha avulsa)';
  readonly integrado = false;
  async disponivel() { return false; }
  async transacionar(): Promise<TefResultado> {
    return { aprovado: false, mensagem: 'TEF desligado. Use a maquininha e confirme o valor manualmente.' };
  }
}

/** Simula um TEF aprovado após um pequeno atraso (para testar a UI). */
class SimuladoTefProvider implements TefProvider {
  readonly nome = 'TEF Simulado';
  readonly integrado = true;
  async disponivel() { return true; }
  async transacionar(req: TefRequisicao): Promise<TefResultado> {
    await new Promise((r) => setTimeout(r, 1200));
    const nsu = String(Math.floor(100000 + Math.random() * 899999));
    const autorizacao = String(Math.floor(100000 + Math.random() * 899999));
    const bandeira = req.canal === 'PIX' ? 'PIX' : 'VISA';
    return { aprovado: true, bandeira, nsu, autorizacao, mensagem: 'Transação aprovada (simulada).' };
  }
  async cancelar(): Promise<TefResultado> {
    await new Promise((r) => setTimeout(r, 800));
    return { aprovado: true, cancelado: true, mensagem: 'Estorno simulado.' };
  }
}

/** Stub para o gerenciador real. Lança até ser implementado/configurado. */
class NaoImplementadoTefProvider implements TefProvider {
  readonly integrado = true;
  constructor(readonly nome: string) {}
  async disponivel() { return false; }
  async transacionar(): Promise<TefResultado> {
    return {
      aprovado: false,
      mensagem:
        `Integração ${this.nome} ainda não configurada. ` +
        `Instale o gerenciador e implemente o provider em tef.ts.`,
    };
  }
}

let _provider: TefProvider | null = null;

/** Devolve (memoizado) o provider de TEF conforme VITE_TEF_MODO. */
export function getTefProvider(): TefProvider {
  if (_provider) return _provider;
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const modo = (env.VITE_TEF_MODO || 'desligado').toString().toLowerCase();
  switch (modo) {
    case 'simulado':
      _provider = new SimuladoTefProvider();
      break;
    case 'paygo':
      _provider = new NaoImplementadoTefProvider('PayGo/Elgin');
      break;
    case 'sitef':
      _provider = new NaoImplementadoTefProvider('SiTef/Software Express');
      break;
    default:
      _provider = new DesligadoTefProvider();
  }
  return _provider;
}

/** true se há TEF integrado ativo (habilita os botões TEF na UI). */
export function tefIntegradoAtivo(): boolean {
  const p = getTefProvider();
  return p.integrado;
}
