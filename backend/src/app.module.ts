import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { FiliaisModule } from './modules/filiais/filiais.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { FornecedoresModule } from './modules/fornecedores/fornecedores.module';
import { CustosModule } from './modules/custos/custos.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { EstoqueModule } from './modules/estoque/estoque.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { EntradasModule } from './modules/entradas/entradas.module';
import { ComprasModule } from './modules/compras/compras.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { PdvModule } from './modules/pdv/pdv.module';
import { NFeModule } from './modules/nfe/nfe.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { FiscalReformaModule } from './modules/fiscal-reforma/fiscal-reforma.module';
import { InterpretadorModule } from './modules/interpretador/interpretador.module';
import { ContasReceberModule } from './modules/contas-receber/contas-receber.module';
import { ContasPagarModule } from './modules/contas-pagar/contas-pagar.module';
import { FluxoCaixaModule } from './modules/fluxo-caixa/fluxo-caixa.module';
import { DreModule } from './modules/dre/dre.module';
import { PlanoContasModule } from './modules/plano-contas/plano-contas.module';
import { TesourariaModule } from './modules/tesouraria/tesouraria.module';
import { RecorrenciasModule } from './modules/recorrencias/recorrencias.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { PrecificacaoModule } from './modules/precificacao/precificacao.module';
import { DevolucoesCompraModule } from './modules/devolucoes-compra/devolucoes-compra.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AssinaturasModule } from './modules/assinaturas/assinaturas.module';
import { PlataformaModule } from './modules/plataforma/plataforma.module';
import { IaModule } from './modules/ia/ia.module';
import { RestauranteModule } from './modules/restaurante/restaurante.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissoesGuard } from './common/guards/permissoes.guard';
import { FilialGuard } from './common/guards/filial.guard';
import { PlanoGateGuard } from './common/guards/plano-gate.guard';
import { getJwtSecret } from './common/config/jwt-secret';
import { HealthController } from './health.controller';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    // Rate limiting global: 120 req/min por IP (protege contra abuso/brute-force).
    // Endpoints sensíveis (login, IA) têm limites mais rígidos via @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({
      secret: getJwtSecret(),
      global: true,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any },
    }),
    PrismaModule,
    AuthModule,
    FiliaisModule,
    ClientesModule,
    FornecedoresModule,
    CustosModule,
    ProdutosModule,
    EstoqueModule,
    InventarioModule,
    EntradasModule,
    ComprasModule,
    PedidosModule,
    PdvModule,
    NFeModule,
    FiscalModule,
    FiscalReformaModule,
    InterpretadorModule,
    ContasReceberModule,
    ContasPagarModule,
    FluxoCaixaModule,
    DreModule,
    PlanoContasModule,
    TesourariaModule,
    RecorrenciasModule,
    NotificacoesModule,
    RelatoriosModule,
    PrecificacaoModule,
    DevolucoesCompraModule,
    AuditoriaModule,
    DashboardModule,
    UsuariosModule,
    AssinaturasModule,
    PlataformaModule,
    IaModule,
    RestauranteModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RBAC global: roda depois do JwtAuthGuard (que popula req.user). Rotas sem
    // @RequirePermissao passam direto; as com decorator agora são SEMPRE checadas
    // — antes o guard só valia em controllers que o declaravam localmente.
    { provide: APP_GUARD, useClass: PermissoesGuard },
    // Isolamento entre filiais/boxes da mesma empresa: valida qualquer filialId
    // recebido contra as filiais do usuário. ADMIN passa.
    { provide: APP_GUARD, useClass: FilialGuard },
    // Gate de PLANO (SaaS): valida status da assinatura e features contratadas.
    // Tenants sem assinatura (seed/legado) passam direto.
    { provide: APP_GUARD, useClass: PlanoGateGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
