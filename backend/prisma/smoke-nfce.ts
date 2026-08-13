/**
 * Smoke test da NFC-e (modelo 65) em modo SIMULAÇÃO — ponta a ponta via DI real.
 * Não transmite nada. Rodar: NFCE_MODO=simulado npx ts-node prisma/smoke-nfce.ts
 */
process.env.NFCE_MODO = process.env.NFCE_MODO || 'simulado';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NfceService } from '../src/modules/nfe/nfce.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const nfce = app.get(NfceService);

  console.log(`NFCE habilitado=${nfce.habilitado()} modo=${process.env.NFCE_MODO}`);

  // Pega uma venda de PDV já registrada (Pedido tipo VENDA, faturado).
  const pedido = await prisma.pedido.findFirst({
    where: { tipo: 'VENDA' },
    orderBy: { dataEmissao: 'desc' },
    include: { itens: true },
  });
  if (!pedido) {
    console.error('❌ Nenhum pedido tipo VENDA encontrado para o smoke test.');
    await app.close();
    process.exit(1);
  }
  console.log(`Pedido ${pedido.numero} (${pedido.id}) — ${pedido.itens.length} item(ns), total ${pedido.valorTotal}`);

  const r = await nfce.emitirDePedido(pedido.tenantId, pedido.id, pedido.filialOrigemId, 'smoke');
  console.log('✅ Resultado NFC-e:');
  console.log(JSON.stringify(r, null, 2));

  // Confirma persistência dos campos NFC-e (qrCode / urlConsultaNfce).
  const salvo = await prisma.nFe.findFirst({
    where: { pedidoId: pedido.id, modelo: '65' },
    select: { numero: true, modelo: true, tipo: true, status: true, chaveAcesso: true, qrCode: true, urlConsultaNfce: true },
  });
  console.log('📄 Persistido no banco:');
  console.log(JSON.stringify(salvo, null, 2));

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Smoke falhou:', e);
  process.exit(1);
});
