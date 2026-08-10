import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { IaProvider } from './ia-provider.interface';

/**
 * Provider do Google Gemini (Flash) via API REST — sem SDK, usando o `fetch`
 * nativo do Node 20. Escolhido por ter tier grátis e custo baixo.
 *
 * Config (env):
 *   GEMINI_API_KEY  → chave criada em https://aistudio.google.com/apikey
 *   GEMINI_MODEL    → modelo (padrão: gemini-2.0-flash)
 */
@Injectable()
export class GeminiProvider implements IaProvider {
  private readonly log = new Logger('IA:Gemini');
  private readonly base = 'https://generativelanguage.googleapis.com/v1beta';

  nome() {
    return 'gemini';
  }

  private get apiKey(): string {
    return process.env.GEMINI_API_KEY?.trim() || '';
  }

  private get model(): string {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  }

  async gerar(input: {
    sistema: string;
    prompt: string;
    maxTokens?: number;
    temperatura?: number;
    historico?: { autor: 'user' | 'lu'; texto: string }[];
    /** Quando true, pede ao modelo uma resposta em JSON puro (para classificação/extração). */
    json?: boolean;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new BadGatewayException('IA indisponível: GEMINI_API_KEY não configurada.');
    }

    const url = `${this.base}/models/${this.model}:generateContent?key=${this.apiKey}`;
    // Turnos anteriores (memória curta do chat) + a mensagem atual do usuário.
    // No Gemini, o assistente é o papel "model"; o usuário é "user".
    const contents = [
      ...(input.historico || [])
        .filter((m) => m?.texto?.trim())
        .map((m) => ({ role: m.autor === 'lu' ? 'model' : 'user', parts: [{ text: m.texto }] })),
      { role: 'user', parts: [{ text: input.prompt }] },
    ];
    const body: any = {
      systemInstruction: { parts: [{ text: input.sistema }] },
      contents,
      generationConfig: {
        temperature: input.temperatura ?? 0.4,
        maxOutputTokens: input.maxTokens ?? 400,
        ...(input.json ? { responseMimeType: 'application/json' } : {}),
      },
    };

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.log.error(`Falha de rede ao chamar o Gemini: ${e}`);
      throw new BadGatewayException('Não consegui falar com a IA agora.');
    }

    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '');
      this.log.error(`Gemini HTTP ${resp.status}: ${detalhe.slice(0, 300)}`);
      throw new BadGatewayException('A IA respondeu com erro.');
    }

    const data: any = await resp.json();
    const texto: string = (data?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join('')
      .trim();

    if (!texto) {
      this.log.warn(`Gemini retornou sem texto: ${JSON.stringify(data).slice(0, 300)}`);
      throw new BadGatewayException('A IA não retornou uma resposta.');
    }
    return texto;
  }
}
