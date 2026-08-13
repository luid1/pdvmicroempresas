import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssinaturasController } from './assinaturas.controller';
import { AssinaturasService } from './assinaturas.service';
import { MercadoPagoService } from './mercado-pago.service';
import { ProvisionamentoService } from './provisionamento.service';
import { EmailService } from './email.service';

/**
 * Módulo SaaS: catálogo de planos, checkout self-service com Mercado Pago,
 * provisionamento automático de tenants e webhook de cobrança recorrente.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AssinaturasController],
  providers: [AssinaturasService, MercadoPagoService, ProvisionamentoService, EmailService],
  exports: [AssinaturasService],
})
export class AssinaturasModule {}
