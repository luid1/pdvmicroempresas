import { Module } from '@nestjs/common';
import { DreService } from './dre.service';
import { DreController } from './dre.controller';
import { PlanoContasModule } from '../plano-contas/plano-contas.module';

@Module({
  imports: [PlanoContasModule],
  providers: [DreService],
  controllers: [DreController],
  exports: [DreService],
})
export class DreModule {}
