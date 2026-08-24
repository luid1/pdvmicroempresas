/**
 * Validação de variáveis de ambiente no boot (fail-fast).
 *
 * Em vez de descobrir uma env faltando lá na frente (numa venda, numa nota),
 * a aplicação recusa a subir se algo essencial não estiver configurado — e só
 * avisa (warning) o que é recomendado em produção mas não bloqueia.
 *
 * Sem dependência nova (Joi/zod): checagem simples e explícita.
 */

type Nivel = 'erro' | 'aviso';

interface Problema {
  nivel: Nivel;
  chave: string;
  motivo: string;
}

const INSEGUROS = new Set([
  'change-me',
  'changeme',
  'secret',
  'mercado-pdv-jwt-secret-dev',
  'dev',
]);

function ehInseguro(valor: string): boolean {
  const v = valor.trim().toLowerCase();
  return INSEGUROS.has(v) || v.length < 16;
}

/**
 * Valida o ambiente. Lança Error (derruba o boot) se houver problema de nível
 * "erro"; imprime avisos para os de nível "aviso". Retorna nada.
 */
export function validarAmbiente(env: NodeJS.ProcessEnv = process.env): void {
  const isProd = env.NODE_ENV === 'production';
  const problemas: Problema[] = [];

  // ── Essenciais (sempre) ──
  if (!env.DATABASE_URL?.trim()) {
    problemas.push({ nivel: 'erro', chave: 'DATABASE_URL', motivo: 'sem conexão com o banco de dados.' });
  }

  // ── JWT ──
  const jwt = env.JWT_SECRET?.trim();
  if (!jwt) {
    // Em dev há fallback; em prod é obrigatório.
    problemas.push({ nivel: isProd ? 'erro' : 'aviso', chave: 'JWT_SECRET', motivo: 'segredo de assinatura dos tokens ausente.' });
  } else if (isProd && ehInseguro(jwt)) {
    problemas.push({ nivel: 'erro', chave: 'JWT_SECRET', motivo: 'valor fraco/placeholder — troque por um segredo forte (≥32 chars).' });
  }

  // ── Recomendados em produção (avisos) ──
  if (isProd && !env.FRONTEND_URL?.trim()) {
    problemas.push({ nivel: 'aviso', chave: 'FRONTEND_URL', motivo: 'sem allowlist de CORS — origens cruzadas serão bloqueadas.' });
  }

  // ── Fiscal: se a emissão está ligada, a chave de criptografia é obrigatória ──
  const nfceModo = (env.NFCE_MODO || 'desligado').trim().toLowerCase();
  const fiscalLigado = nfceModo !== 'desligado';
  if (fiscalLigado && !env.FISCAL_ENC_KEY?.trim()) {
    problemas.push({ nivel: 'erro', chave: 'FISCAL_ENC_KEY', motivo: `NFCE_MODO=${nfceModo} exige a chave de criptografia do token fiscal.` });
  }
  if (fiscalLigado && !env.CERT_ENC_KEY?.trim()) {
    problemas.push({ nivel: 'aviso', chave: 'CERT_ENC_KEY', motivo: 'recomendada para proteger a senha do certificado A1 armazenado.' });
  }

  const erros = problemas.filter((p) => p.nivel === 'erro');
  const avisos = problemas.filter((p) => p.nivel === 'aviso');

  for (const a of avisos) {
    console.warn(`⚠️  [env] ${a.chave}: ${a.motivo}`);
  }

  if (erros.length) {
    const lista = erros.map((e) => `   • ${e.chave}: ${e.motivo}`).join('\n');
    throw new Error(`Configuração de ambiente inválida — a aplicação não vai subir:\n${lista}`);
  }
}
