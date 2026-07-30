import { Module } from '@nestjs/common';
import { InterpretadorController } from './interpretador.controller';
import { InterpretadorService } from './interpretador.service';

@Module({
  controllers: [InterpretadorController],
  providers: [InterpretadorService],
  exports: [InterpretadorService],
})
export class InterpretadorModule {}
