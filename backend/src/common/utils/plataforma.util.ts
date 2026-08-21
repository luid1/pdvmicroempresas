/**
 * Identidade do DONO DA PLATAFORMA (SaaS).
 *
 * Um usuário é dono da plataforma quando:
 *   - tem a flag `isSuperAdmin` marcada no banco, OU
 *   - o e-mail dele está listado em PLATFORM_OWNER_EMAIL (bootstrap por ambiente,
 *     aceita lista separada por vírgula) — garante acesso mesmo antes de marcar a
 *     flag no banco, sem precisar rodar SQL na mão.
 *
 * O painel /plataforma e os guards cross-tenant usam SEMPRE esta função como
 * fonte única de verdade.
 */
export function ehDonoPlataforma(email?: string | null, flagBanco?: boolean | null): boolean {
  if (flagBanco) return true;
  const alvo = (email || '').trim().toLowerCase();
  if (!alvo) return false;
  const lista = (process.env.PLATFORM_OWNER_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(alvo);
}
