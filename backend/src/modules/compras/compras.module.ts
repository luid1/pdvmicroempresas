import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { EstoqueModule } from '../estoque/estoque.module';

@Module({
  imports: [EstoqueModule],
  providers: [ComprasService],
  controllers: [ComprasController],
  exports: [ComprasService],
})
export class ComprasModule {}
