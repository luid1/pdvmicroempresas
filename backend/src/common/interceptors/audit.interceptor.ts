import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ENTIDADE_KEY } from '../decorators/context.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService, private reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>('skipAudit', [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (skip) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const method = req.method;

    // Só audita mutações
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const user = req.user;
    if (!user) return next.handle();

    const modulo = this.reflector.getAllAndOverride<string>('modulo', [
      ctx.getHandler(), ctx.getClass(),
    ]) || 'SISTEMA';

    const auditMeta = this.reflector.getAllAndOverride<{ entidade: string; prismaModel?: string }>(
      AUDIT_ENTIDADE_KEY, [ctx.getHandler(), ctx.getClass()],
    );

    const acaoMap: Record<string, string> = {
      POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE',
    };

    // Nome legível da entidade: prefere o decorator; senão deriva o 1º segmento
    // estático da rota (ex.: `/pedidos/:id/confirmar` → `pedidos`) em vez da URL crua.
    const entidade = auditMeta?.entidade || this.entidadeFromRoute(req);
    const entidadeId = req.params?.id;

    // Snapshot "antes" só faz sentido em alterações/remoções de um registro
    // conhecido (UPDATE/DELETE com model Prisma declarado e :id na rota).
    const capturaAntes =
      !!auditMeta?.prismaModel &&
      !!entidadeId &&
      (method === 'PUT' || method === 'PATCH' || method === 'DELETE');

    const antes$ = capturaAntes
      ? from(this.snapshotAntes(auditMeta!.prismaModel!, entidadeId))
      : from(Promise.resolve(null));

    return antes$.pipe(
      switchMap((dadosAntes) =>
        next.handle().pipe(
          tap(async (result) => {
            try {
              await this.prisma.auditLog.create({
                data: {
                  tenantId: user.tenantId,
                  usuarioId: user.id,
                  modulo,
                  acao: acaoMap[method],
                  entidade,
                  entidadeId: result?.id || entidadeId,
                  dadosAntes: dadosAntes ? JSON.parse(JSON.stringify(dadosAntes)) : null,
                  dadosDepois: result ? JSON.parse(JSON.stringify(result)) : null,
                  ip: req.ip,
                  userAgent: req.headers?.['user-agent'],
                },
              });
            } catch { /* Falha silenciosa — auditoria não pode derrubar a operação */ }
          }),
        ),
      ),
    );
  }

  private entidadeFromRoute(req: any): string {
    const path: string = req.route?.path || req.url || '';
    const seg = path.split('?')[0].split('/').find((s) => s && !s.startsWith(':'));
    return seg || 'SISTEMA';
  }

  private async snapshotAntes(model: string, id: string): Promise<any> {
    try {
      const delegate = (this.prisma as any)[model];
      if (!delegate?.findUnique) return null;
      return await delegate.findUnique({ where: { id } });
    } catch {
      return null; // model/where inválido — não bloquear a operação
    }
  }
}
