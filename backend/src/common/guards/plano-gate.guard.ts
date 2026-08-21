import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Gate de PLANO (SaaS). Roda depois do JwtAuthGuard (req.user já populado) e
 * complementa o RBAC: enquanto o RBAC diz "este usuário pode a ação X", o gate
 * diz "a empresa contratou o recurso X e está em dia".
 *
 * Regras:
 *  - Rota pública ou sem usuário → libera (o funil de compra é público).
 *  - Tenant SEM Assinatura (empresas legadas/seed) → libera (não é SaaS).
 *  - Com Assinatura:
 *      · CANCELADA           → 403 (assinatura encerrada)
 *      · SUSPENSA            → 403 (pagamento pendente)
 *      · TRIAL vencido       → 403 (período de teste terminou)
 *      · ATIVA / TRIAL válido → segue
 *  - @Modulo(FEATURE): se o valor for uma flag de plano e não estiver liberada
 *    no plano contratado → 403 (faça upgrade). Valores que não são flags de
 *    plano (uso só de auditoria) são ignorados aqui.
 *
 * Cache curto em memória (30s) por tenant para evitar 1 query por request.
 */
const FEATURES_DE_PLANO = new Set([
  'PDV', 'ESTOQUE', 'CADASTROS', 'RELATORIOS_BASICOS',
  'NFCE', 'FINANCEIRO', 'TESOURARIA', 'TEF', 'VALIDADE', 'PRECIFICACAO', 'DEVOLUCOES', 'RELATORIOS_VENDAS',
  'NFE', 'MULTIFILIAL', 'IA_PEDIDOS', 'RECORRENCIAS', 'PLANO_CONTAS', 'AUDITORIA', 'RELATORIOS_GERENCIAIS', 'NOTIFICACOES', 'API',
]);

type Cache = { at: number; status: string; trialAte: Date | null; features: string[] } | null;

@Injectable()
export class PlanoGateGuard implements CanActivate {
  private cache = new Map<string, Cache>();
  private readonly ttl = 30_000;

  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.tenantId) return true;
    if (user.isSuperAdmin) return true; // dono da plataforma não é limitado por plano

    const info = await this.carregar(user.tenantId);
    if (!info) return true; // tenant sem assinatura (legado) → não aplica gate

    // 1. Status da cobrança.
    if (info.status === 'CANCELADA') {
      throw new ForbiddenException('Assinatura cancelada. Reative seu plano para continuar.');
    }
    if (info.status === 'SUSPENSA') {
      throw new ForbiddenException('Pagamento pendente. Regularize a assinatura para voltar a usar o sistema.');
    }
    if (info.status === 'TRIAL' && info.trialAte && info.trialAte.getTime() < Date.now()) {
      throw new ForbiddenException('Seu período de teste terminou. Escolha um plano para continuar.');
    }

    // 2. Feature do plano (quando a rota declara @Modulo com uma flag de plano).
    const modulo = this.reflector.getAllAndOverride<string>('modulo', [ctx.getHandler(), ctx.getClass()]);
    if (modulo && FEATURES_DE_PLANO.has(modulo) && !info.features.includes(modulo)) {
      throw new ForbiddenException(`Recurso "${modulo}" não está incluso no seu plano. Faça upgrade para liberar.`);
    }

    return true;
  }

  private async carregar(tenantId: string) {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < this.ttl) return cached;

    const a = await this.prisma.assinatura.findUnique({
      where: { tenantId },
      select: { status: true, trialAte: true, plano: { select: { features: true } } },
    });
    const info: Cache = a
      ? { at: Date.now(), status: a.status, trialAte: a.trialAte, features: a.plano.features }
      : null;
    this.cache.set(tenantId, info);
    return info;
  }
}
