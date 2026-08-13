import { Module } from '@nestjs/common';
import { CustosService } from './custos.service';
import { CustosController } from './custos.controller';

@Module({ providers: [CustosService], controllers: [CustosController], exports: [CustosService] })
export class CustosModule {}
