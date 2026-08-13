import { Module } from '@nestjs/common';
import { PrecificacaoService } from './precificacao.service';
import { PrecificacaoController } from './precificacao.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';

@Module({
  providers: [PrecificacaoService, PermissoesGuard],
  controllers: [PrecificacaoController],
  exports: [PrecificacaoService],
})
export class PrecificacaoModule {}
