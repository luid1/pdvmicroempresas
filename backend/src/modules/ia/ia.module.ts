import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { GeminiProvider } from './providers/gemini.provider';
import { DashboardModule } from '../dashboard/dashboard.module';
import { EstoqueModule } from '../estoque/estoque.module';
import { CustosModule } from '../custos/custos.module';

@Module({
  imports: [DashboardModule, EstoqueModule, CustosModule],
  controllers: [IaController],
  providers: [IaService, GeminiProvider],
  exports: [IaService],
})
export class IaModule {}
