import { Module } from '@nestjs/common';
import { RestauranteService } from './restaurante.service';
import { RestauranteController } from './restaurante.controller';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { PdvModule } from '../pdv/pdv.module';

@Module({
  // PdvModule fornece o SessaoCaixaService — o fechamento de conta lança a venda
  // no caixa aberto (mantendo a segurança de sessão/turno).
  imports: [PdvModule],
  providers: [RestauranteService, PermissoesGuard],
  controllers: [RestauranteController],
  exports: [RestauranteService],
})
export class RestauranteModule {}
