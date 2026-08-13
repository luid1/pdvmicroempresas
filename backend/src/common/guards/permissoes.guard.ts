import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSOES_KEY } from '../decorators/permissoes.decorator';

/**
 * Guard de RBAC granular. Roda DEPOIS do JwtAuthGuard global (que popula req.user).
 * Lê as permissões exigidas via @RequirePermissao(...) e compara com as permissões
 * do usuário (array `MODULO:ACAO` montado no JwtStrategy).
 *
 * Regras:
 *  - Sem @RequirePermissao na rota → libera (nada a validar).
 *  - role === 'ADMIN' → libera sempre (consistente com o front `podeVerTela`).
 *  - Aceita tanto o separador ':' quanto '.' (ex.: 'financeiro.operar' == 'FINANCEIRO:OPERAR').
 *  - Caso contrário → 403 explicando a permissão que falta.
 */
@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requeridas = this.reflector.getAllAndOverride<string[]>(PERMISSOES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requeridas || requeridas.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Usuário não autenticado.');
    if (user.role === 'ADMIN') return true;

    const normalizar = (p: string) => p.toUpperCase().replace(/\./g, ':').trim();
    const doUsuario = new Set<string>((user.permissoes || []).map(normalizar));

    const faltando = requeridas
      .map(normalizar)
      .filter((req) => !doUsuario.has(req));

    if (faltando.length > 0) {
      throw new ForbiddenException(
        `Permissão insuficiente. Requer: ${faltando.join(', ')}.`,
      );
    }
    return true;
  }
}
