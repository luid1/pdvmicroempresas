import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().user,
);

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().user?.tenantId,
);

export const CurrentFilial = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().headers['x-filial-id'],
);

export const Public = () => SetMetadata('isPublic', true);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export const Modulo = (modulo: string) => SetMetadata('modulo', modulo);
export const SkipAudit = () => SetMetadata('skipAudit', true);

/**
 * Nomeia a entidade auditada e, opcionalmente, o model Prisma correspondente
 * para que o `AuditInterceptor` capture o snapshot "antes" em UPDATE/DELETE.
 *
 * Ex.: @AuditEntidade('Pedido', 'pedido') numa rota `/pedidos/:id`.
 * Se `prismaModel` for omitido, apenas o nome legível da entidade é registrado
 * (sem snapshot antes).
 */
export const AUDIT_ENTIDADE_KEY = 'auditEntidade';
export const AuditEntidade = (entidade: string, prismaModel?: string) =>
  SetMetadata(AUDIT_ENTIDADE_KEY, { entidade, prismaModel });
