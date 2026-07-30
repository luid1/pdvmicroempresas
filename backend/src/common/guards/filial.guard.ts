import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Impede acesso cruzado entre filiais/boxes da MESMA empresa.
 *
 * O isolamento entre empresas (tenant) já é garantido pelo JWT/TenantInterceptor.
 * Este guard fecha o furo interno: antes, qualquer usuário logado podia ler/operar
 * a filial de outro simplesmente mandando outro `filialId` no parâmetro/query/header.
 *
 * Regras:
 *  - Sem usuário (rota pública) → libera.
 *  - role === 'ADMIN' → libera (enxerga todas as filiais).
 *  - Coleta todo `filialId` presente na requisição (param, query, header
 *    x-filial-id e body: filialId / filialOrigemId / filialDestinoId) e exige
 *    que TODOS pertençam às filiais do usuário (`req.user.filiais`).
 *  - Qualquer filial fora da lista → 403.
 *
 * Roda como guard global DEPOIS do JwtAuthGuard (que popula req.user).
 */
@Injectable()
export class FilialGuard implements CanActivate {
  private static readonly CHAVES = ['filialId', 'filialOrigemId', 'filialDestinoId'];

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true;                 // rota pública
    if (user.role === 'ADMIN') return true; // ADMIN opera todas as filiais

    const permitidas: string[] = Array.isArray(user.filiais) ? user.filiais : [];

    const candidatos = new Set<string>();
    const coletar = (v: unknown) => { if (typeof v === 'string' && v.trim()) candidatos.add(v.trim()); };

    for (const chave of FilialGuard.CHAVES) {
      coletar(req.params?.[chave]);
      coletar(req.query?.[chave]);
      coletar(req.body?.[chave]);
    }
    coletar(req.headers?.['x-filial-id']);

    for (const filialId of candidatos) {
      if (!permitidas.includes(filialId)) {
        throw new ForbiddenException('Acesso negado a esta filial/box.');
      }
    }
    return true;
  }
}
