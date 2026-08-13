import { Module } from '@nestjs/common';
import { EstoqueService } from './estoque.service';
import { EstoqueController } from './estoque.controller';

@Module({ providers: [EstoqueService], controllers: [EstoqueController], exports: [EstoqueService] })
export class EstoqueModule {}
