import { Module } from '@nestjs/common';
import { RecorrenciasService } from './recorrencias.service';
import { RecorrenciasController } from './recorrencias.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { ContasPagarModule } from '../contas-pagar/contas-pagar.module';

@Module({
  imports: [ContasPagarModule],
  providers: [RecorrenciasService, PermissoesGuard],
  controllers: [RecorrenciasController],
  exports: [RecorrenciasService],
})
export class RecorrenciasModule {}
