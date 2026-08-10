/**
 * Espelho da regra do frontend (`config/telas.ts::podeVerTela`): decide se um
 * perfil pode ver uma tela. Usado no backend para escopar a IA pelos mesmos
 * acessos que o usuário já tem no menu.
 *
 * - role 'ADMIN' vê tudo.
 * - `telas` com '*' vê tudo.
 * - senão, precisa conter a chave exata da tela (ex.: '/financeiro/dre').
 */
export function podeVerTela(telas: string[] | undefined, role: string | undefined, key: string): boolean {
  if (role === 'ADMIN') return true;
  if (!telas || telas.length === 0) return false;
  return telas.includes('*') || telas.includes(key);
}

/** true se o perfil pode ver ao menos UMA das telas informadas. */
export function podeVerAlguma(telas: string[] | undefined, role: string | undefined, keys: string[]): boolean {
  return keys.some((k) => podeVerTela(telas, role, k));
}
