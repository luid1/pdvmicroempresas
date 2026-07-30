import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { NotificacoesController } from './notificacoes.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';

@Module({
  providers: [NotificacoesService, PermissoesGuard],
  controllers: [NotificacoesController],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
