import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SeveridadeNotificacao, TipoNotificacao } from '@prisma/client';

export class CriarNotificacaoDto {
  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  filialId?: string;

  @IsOptional()
  @IsString()
  permissao?: string;

  @IsOptional()
  @IsEnum(TipoNotificacao)
  tipo?: TipoNotificacao;

  @IsOptional()
  @IsEnum(SeveridadeNotificacao)
  severidade?: SeveridadeNotificacao;

  @IsString()
  @MaxLength(160)
  titulo!: string;

  @IsString()
  @MaxLength(1000)
  mensagem!: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  chaveDedup?: string;
}
