/**
 * Smoke test do funil self-service (modo SIMULADO — sem Mercado Pago real).
 * Rodar: npx ts-node prisma/smoke-assinatura.ts
 *
 * Exercita: checkout → provisiona tenant/filial/perfis/admin + assinatura TRIAL
 * → cria "preapproval" simulado → webhook (authorized) → assinatura ATIVA.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AssinaturasService } from '../src/modules/assinaturas/assinaturas.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  process.env.MP_MODO = 'simulado';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const svc = app.get(AssinaturasService);
  const prisma = app.get(PrismaService);

  const cnpj = `55.${Date.now().toString().slice(-9)}/0001-99`.slice(0, 18);
  const email = `dono${Date.now()}@teste.com`;

  console.log('\n🛒 Checkout PROFISSIONAL (simulado)...');
  const out = await svc.checkout({
    planoCodigo: 'PROFISSIONAL',
    razaoSocial: 'Mercadinho do João Ltda',
    nomeFantasia: 'Mercadinho do João',
    cnpj,
    adminNome: 'João Silva',
    adminEmail: email,
    adminSenha: 'segredo123',
  });
  console.log('   →', out);

  const antes = await svc.statusDoTenant(out.tenantId);
  console.log('   status inicial:', antes.status, '| plano:', antes.plano?.nome);

  console.log('\n🔔 Webhook MP (authorized)...');
  const wh = await svc.processarWebhook({ type: 'subscription_preapproval', data: { id: `SIM-${out.assinaturaId}` } });
  console.log('   →', wh);

  const depois = await svc.statusDoTenant(out.tenantId);
  console.log('   status final:', depois.status, '| próxima cobrança:', depois.proximaCobranca);

  const usuarios = await prisma.usuario.count({ where: { tenantId: out.tenantId } });
  const roles = await prisma.role.count({ where: { tenantId: out.tenantId } });
  const filiais = await prisma.filial.count({ where: { tenantId: out.tenantId } });
  console.log(`\n📦 Ambiente provisionado: ${filiais} filial, ${roles} perfis, ${usuarios} usuário(admin).`);

  console.log('\n✅ Fluxo self-service OK (simulado).');
  await app.close();
}

main().catch((e) => {
  console.error('❌ Erro:', e);
  process.exit(1);
});
