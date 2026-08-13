import { Injectable, Logger } from '@nestjs/common';

/**
 * Serviço de e-mail transacional (boas-vindas, avisos de cobrança).
 *
 * Modo de operação (env `MAIL_MODO`):
 *   - `producao` / `real` → envia de verdade via API do Resend (`RESEND_API_KEY`).
 *   - `simulado` (padrão quando não há key) → não chama a rede; apenas registra
 *     o e-mail no log, permitindo testar o fluxo completo sem provedor.
 *
 * Para produção: crie uma conta em https://resend.com, verifique seu domínio,
 * e defina RESEND_API_KEY + MAIL_FROM (ex.: "Lumin PDV <nao-responda@seudominio.com.br>").
 */
@Injectable()
export class EmailService {
  private readonly log = new Logger('Email');
  private readonly endpoint = 'https://api.resend.com/emails';

  private get apiKey(): string {
    return process.env.RESEND_API_KEY?.trim() || '';
  }

  private get from(): string {
    return process.env.MAIL_FROM?.trim() || 'Lumin PDV <onboarding@resend.dev>';
  }

  private get appUrl(): string {
    return (process.env.APP_URL || 'http://localhost:3013').replace(/\/$/, '');
  }

  /** Simula quando não há key OU quando MAIL_MODO força simulado. */
  simulado(): boolean {
    const modo = (process.env.MAIL_MODO || '').trim().toLowerCase();
    if (modo === 'producao' || modo === 'real') return false;
    if (modo === 'simulado') return true;
    return !this.apiKey; // auto: sem key ⇒ simulado
  }

  /** Envia um e-mail HTML. Em modo simulado apenas registra no log. */
  async enviar(input: { para: string; assunto: string; html: string }): Promise<{ ok: boolean; simulado: boolean }> {
    if (this.simulado()) {
      this.log.warn(`[SIMULADO] e-mail para <${input.para}> — "${input.assunto}"`);
      return { ok: true, simulado: true };
    }
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.para],
          subject: input.assunto,
          html: input.html,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.log.error(`Falha ao enviar e-mail para ${input.para}: ${res.status} ${txt}`);
        return { ok: false, simulado: false };
      }
      this.log.log(`E-mail enviado para ${input.para}: "${input.assunto}"`);
      return { ok: true, simulado: false };
    } catch (e: any) {
      this.log.error(`Erro ao enviar e-mail para ${input.para}: ${e?.message || e}`);
      return { ok: false, simulado: false };
    }
  }

  /**
   * E-mail de boas-vindas pós-assinatura: confirma o acesso e leva ao login.
   * Não inclui a senha (o próprio cliente a definiu no checkout).
   */
  async boasVindas(input: {
    para: string;
    nome: string;
    empresa: string;
    plano: string;
    trialDias: number;
  }): Promise<{ ok: boolean; simulado: boolean }> {
    const loginUrl = `${this.appUrl}/login`;
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
      <div style="background:#4f46e5;color:#fff;padding:28px 24px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:22px;">Bem-vindo ao Lumin PDV 🛒</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
        <p>Olá, <strong>${input.nome}</strong>!</p>
        <p>Sua assinatura do plano <strong>${input.plano}</strong> foi criada com sucesso para
           <strong>${input.empresa}</strong>. Seu ambiente já está pronto para uso, com
           <strong>${input.trialDias} dias de teste</strong> inclusos.</p>
        <p>Acesse com o e-mail <strong>${input.para}</strong> e a senha que você definiu na contratação:</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${loginUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;
             padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">
            Entrar no sistema
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${loginUrl}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Lumin PDV — gestão e frente de caixa para o seu mercado.</p>
      </div>
    </div>`;
    return this.enviar({ para: input.para, assunto: 'Bem-vindo ao Lumin PDV — seu acesso está pronto', html });
  }
}
