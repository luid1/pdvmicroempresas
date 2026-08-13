/**
 * Resolve o segredo do JWT de forma segura.
 *
 * - Em produção (NODE_ENV=production): a variável JWT_SECRET é OBRIGATÓRIA e não pode
 *   ser o valor inseguro de exemplo. Se faltar, a aplicação não sobe (falha explícita).
 * - Em desenvolvimento: usa JWT_SECRET se existir; caso contrário, cai em um valor
 *   de dev com aviso no console (nunca deve ser usado em produção).
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const inseguros = ['secret', 'erp-wms-jwt-secret-troque-em-producao'];

  if (isProd) {
    if (!secret || inseguros.includes(secret)) {
      throw new Error(
        'JWT_SECRET ausente ou inseguro em produção. Defina uma JWT_SECRET forte e única na variável de ambiente.',
      );
    }
    return secret;
  }

  if (!secret) {
    // eslint-disable-next-line no-console
    console.warn(
      '⚠️  JWT_SECRET não definido — usando segredo de DESENVOLVIMENTO. NUNCA use isso em produção.',
    );
    return 'dev-only-insecure-secret';
  }
  return secret;
}
