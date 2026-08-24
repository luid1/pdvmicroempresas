import { IsEnum } from 'class-validator';
import { ModoOperacao } from '@prisma/client';

export class DefinirModoDto {
  @IsEnum(ModoOperacao, { message: 'modo deve ser VAREJO, RESTAURANTE ou HIBRIDO.' })
  modo!: ModoOperacao;
}
