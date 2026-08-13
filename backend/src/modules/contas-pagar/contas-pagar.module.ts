import { Module } from '@nestjs/common';
import { ContasPagarService } from './contas-pagar.service';
import { ContasPagarController } from './contas-pagar.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { PlanoContasModule } from '../plano-contas/plano-contas.module';
import { TesourariaModule } from '../tesouraria/tesouraria.module';

@Module({
  imports: [PlanoContasModule, TesourariaModule],
  providers: [ContasPagarService, PermissoesGuard],
  controllers: [ContasPagarController],
  exports: [ContasPagarService],
})
export class ContasPagarModule {}
