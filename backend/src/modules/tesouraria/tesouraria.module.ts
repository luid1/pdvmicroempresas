import { Module } from '@nestjs/common';
import { TesourariaService } from './tesouraria.service';
import { TesourariaController } from './tesouraria.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';

@Module({
  providers: [TesourariaService, PermissoesGuard],
  controllers: [TesourariaController],
  exports: [TesourariaService],
})
export class TesourariaModule {}
