import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { EstoqueModule } from '../estoque/estoque.module';

@Module({ imports: [EstoqueModule], providers: [InventarioService], controllers: [InventarioController], exports: [InventarioService] })
export class InventarioModule {}
