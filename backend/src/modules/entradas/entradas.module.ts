import { Module } from '@nestjs/common';
import { EntradasService } from './entradas.service';
import { EntradasController } from './entradas.controller';
import { EstoqueModule } from '../estoque/estoque.module';

@Module({
  imports: [EstoqueModule],
  providers: [EntradasService],
  controllers: [EntradasController],
  exports: [EntradasService],
})
export class EntradasModule {}
