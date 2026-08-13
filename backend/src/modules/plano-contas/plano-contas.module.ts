import { Module } from '@nestjs/common';
import { PlanoContasService } from './plano-contas.service';
import { PlanoContasController } from './plano-contas.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';

@Module({
  providers: [PlanoContasService, PermissoesGuard],
  controllers: [PlanoContasController],
  exports: [PlanoContasService],
})
export class PlanoContasModule {}
