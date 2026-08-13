import { Injectable, Logger, BadGatewayException } from '@nestjs/common';

/**
 * Cliente da API de Assinaturas (preapproval) do Mercado Pago.
 *
 * Modo de operação (env `MP_MODO`):
 *   - `producao` / `real` → chama a API do MP com `MP_ACCESS_TOKEN`.
 *   - `simulado` (padrão quando não há token) → não chama a rede; devolve um
 *     `init_point` fake e um id `SIM-...`, permitindo testar todo o fluxo de
 *     checkout/provisionamento localmente sem conta no Mercado Pago.
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
 */
@Injectable()
export class MercadoPagoService {
  private readonly log = new Logger('MercadoPago');
  private readonly base = 'https://api.mercadopago.com';

  private get token(): string {
    return process.env.MP_ACCESS_TOKEN?.trim() || '';
  }

  /** Simula quando não há token OU quando MP_MODO força simulado. */
  simulado(): boolean {
    const modo = (process.env.MP_MODO || '').trim().toLowerCase();
    if (modo === 'producao' || modo === 'real') return false;
    if (modo === 'simulado') return true;
    return !this.token; // auto: sem token ⇒ simulado
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Cria uma assinatura recorrente (preapproval) sem plano pré-cadastrado.
   * Retorna o `id` do preapproval e o `init_point` (URL para o cliente autorizar
   * o pagamento/cartão). O status inicial no MP é `pending` até a autorização.
   */
  async criarPreapproval(input: {
    reason: string;
    /** Valor cobrado a cada ciclo (mês no mensal, ano no anual). */
    valorCiclo: number;
    /** 'mensal' cobra a cada 1 mês; 'anual' cobra a cada 12 meses. */
    periodo?: 'mensal' | 'anual';
    payerEmail: string;
    externalReference: string;
    backUrl: string;
  }): Promise<{ id: string; initPoint: string; status: string }> {
    const anual = input.periodo === 'anual';
    const frequency = anual ? 12 : 1; // meses entre cobranças

    if (this.simulado()) {
      const id = `SIM-${input.externalReference}`;
      const initPoint = `${input.backUrl}?sim=1&preapproval_id=${encodeURIComponent(id)}`;
      this.log.warn(`[SIMULADO] preapproval "${input.reason}" R$${input.valorCiclo} a cada ${frequency} mês(es) → ${id}`);
      return { id, initPoint, status: 'pending' };
    }

    const body = {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      auto_recurring: {
        frequency,
        frequency_type: 'months',
        transaction_amount: Number(input.valorCiclo.toFixed(2)),
        currency_id: 'BRL',
      },
      status: 'pending',
    };

    const res = await fetch(`${this.base}/preapproval`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Falha ao criar preapproval: ${res.status} ${JSON.stringify(json)}`);
      throw new BadGatewayException('Não foi possível iniciar a assinatura no Mercado Pago.');
    }
    return {
      id: String(json.id),
      initPoint: json.init_point || json.sandbox_init_point,
      status: json.status || 'pending',
    };
  }

  /**
   * Ajusta o valor recorrente de um preapproval já existente (usado quando o
   * cliente contrata add-ons de capacidade no painel, mudando a mensalidade).
   * No modo simulado (ou id `SIM-`) só loga e devolve ok, sem tocar na rede.
   */
  async atualizarValorPreapproval(id: string, valorCiclo: number): Promise<{ ok: boolean }> {
    if (this.simulado() || !id || id.startsWith('SIM-')) {
      this.log.warn(`[SIMULADO] atualizar preapproval ${id} → R$${valorCiclo}/ciclo`);
      return { ok: true };
    }
    const body = {
      auto_recurring: {
        transaction_amount: Number(valorCiclo.toFixed(2)),
        currency_id: 'BRL',
      },
    };
    const res = await fetch(`${this.base}/preapproval/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json: any = await res.json().catch(() => ({}));
      this.log.error(`Falha ao atualizar preapproval ${id}: ${res.status} ${JSON.stringify(json)}`);
      throw new BadGatewayException('Não foi possível atualizar o valor da assinatura no Mercado Pago.');
    }
    return { ok: true };
  }

  /** Consulta um preapproval por id (usado pelo webhook para confirmar o status). */
  async consultarPreapproval(id: string): Promise<{ status: string; externalReference?: string; payerEmail?: string } | null> {
    if (this.simulado() || id.startsWith('SIM-')) {
      // No modo simulado consideramos a assinatura autorizada de imediato.
      return { status: 'authorized', externalReference: id.replace(/^SIM-/, '') };
    }
    const res = await fetch(`${this.base}/preapproval/${encodeURIComponent(id)}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      this.log.error(`Falha ao consultar preapproval ${id}: ${res.status}`);
      return null;
    }
    const json: any = await res.json().catch(() => ({}));
    return {
      status: json.status,
      externalReference: json.external_reference,
      payerEmail: json.payer_email,
    };
  }
}
