import { Module } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { EstoqueModule } from '../estoque/estoque.module';
import { PrecificacaoModule } from '../precificacao/precificacao.module';

@Module({ imports: [EstoqueModule, PrecificacaoModule], providers: [PedidosService], controllers: [PedidosController], exports: [PedidosService] })
export class PedidosModule {}
