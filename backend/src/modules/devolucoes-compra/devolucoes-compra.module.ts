import { Module } from '@nestjs/common';
import { DevolucoesCompraService } from './devolucoes-compra.service';
import { DevolucoesCompraController } from './devolucoes-compra.controller';
import { EstoqueModule } from '../estoque/estoque.module';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';

@Module({
  imports: [EstoqueModule],
  providers: [DevolucoesCompraService, PermissoesGuard],
  controllers: [DevolucoesCompraController],
  exports: [DevolucoesCompraService],
})
export class DevolucoesCompraModule {}
