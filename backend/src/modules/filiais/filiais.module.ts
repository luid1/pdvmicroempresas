import { Module } from '@nestjs/common';
import { FiliaisService } from './filiais.service';
import { FiliaisController } from './filiais.controller';

@Module({ providers: [FiliaisService], controllers: [FiliaisController], exports: [FiliaisService] })
export class FiliaisModule {}
