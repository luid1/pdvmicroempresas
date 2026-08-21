import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Restringe a rota ao DONO DA PLATAFORMA (SaaS).
 *
 * Roda como guard LOCAL (via @UseGuards) no controller /plataforma, depois do
 * JwtAuthGuard global (que popula req.user com `isSuperAdmin`). Qualquer usuário
 * que não seja dono da plataforma recebe 403 — mesmo sendo ADMIN da própria loja.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException('Acesso restrito ao dono da plataforma.');
    }
    return true;
  }
}
