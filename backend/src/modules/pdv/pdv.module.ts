import { Module } from '@nestjs/common';
import { PdvService } from './pdv.service';
import { SessaoCaixaService } from './sessao-caixa.service';
import { PdvController } from './pdv.controller';
import { EstoqueModule } from '../estoque/estoque.module';
import { TesourariaModule } from '../tesouraria/tesouraria.module';
import { NFeModule } from '../nfe/nfe.module';

@Module({
  imports: [EstoqueModule, TesourariaModule, NFeModule],
  providers: [PdvService, SessaoCaixaService],
  controllers: [PdvController],
  exports: [PdvService, SessaoCaixaService],
})
export class PdvModule {}
