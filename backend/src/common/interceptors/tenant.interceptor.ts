import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) return next.handle();

    const jwtTenant = req.user.tenantId;

    // Bloqueia qualquer tentativa de injetar tenantId diferente
    if (req.body?.tenantId && req.body.tenantId !== jwtTenant) {
      throw new ForbiddenException('Manipulação de tenantId bloqueada.');
    }

    // Injeta tenantId automaticamente no body
    if (req.body && typeof req.body === 'object') {
      req.body.tenantId = jwtTenant;
    }

    return next.handle();
  }
}
