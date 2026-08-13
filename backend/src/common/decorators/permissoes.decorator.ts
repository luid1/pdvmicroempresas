import { SetMetadata } from '@nestjs/common';

export const PERMISSOES_KEY = 'permissoesRequeridas';

/**
 * Exige uma ou mais permissões no formato `MODULO:ACAO` para acessar a rota.
 * Ex.: @RequirePermissao('FINANCEIRO:OPERAR')
 *
 * A verificação é feita pelo `PermissoesGuard`, que lê o array `permissoes`
 * do usuário autenticado (montado no `JwtStrategy.validate`). O perfil ADMIN
 * (role === 'ADMIN') sempre passa, seguindo a mesma regra do restante do ERP.
 */
export const RequirePermissao = (...permissoes: string[]) =>
  SetMetadata(PERMISSOES_KEY, permissoes);
