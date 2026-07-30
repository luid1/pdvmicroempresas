import { Module } from '@nestjs/common';
import { FluxoCaixaService } from './fluxo-caixa.service';
import { FluxoCaixaController } from './fluxo-caixa.controller';

@Module({
  providers: [FluxoCaixaService],
  controllers: [FluxoCaixaController],
  exports: [FluxoCaixaService],
})
export class FluxoCaixaModule {}
