import { Module } from '@nestjs/common';
import { RestauranteService } from './restaurante.service';
import { RestauranteController } from './restaurante.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';

@Module({
  providers: [RestauranteService, PermissoesGuard],
  controllers: [RestauranteController],
  exports: [RestauranteService],
})
export class RestauranteModule {}
