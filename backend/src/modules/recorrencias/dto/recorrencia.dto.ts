import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';
import { PeriodicidadeRecorrencia } from '@prisma/client';

export class CriarRecorrenciaDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'descricao é obrigatória.' })
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  fornecedorId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  filialId?: string;

  @ApiPropertyOptional({ description: 'Valor fixo. Ignorado (0) quando valorVariavel=true.' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  valor?: number;

  @ApiPropertyOptional({ description: 'Se true, gera Conta a Pagar em rascunho p/ ajuste do valor.' })
  @IsOptional() @IsBoolean()
  valorVariavel?: boolean;

  @ApiPropertyOptional({ description: 'Categoria (código do plano de contas).' })
  @IsOptional() @IsString()
  planoContasCodigo?: string;

  @ApiPropertyOptional({ description: 'Dia de vencimento no mês (1-31).' })
  @IsOptional() @IsInt() @Min(1) @Max(31)
  diaVencimento?: number;

  @ApiPropertyOptional({ enum: PeriodicidadeRecorrencia })
  @IsOptional() @IsEnum(PeriodicidadeRecorrencia)
  periodicidade?: PeriodicidadeRecorrencia;

  @ApiPropertyOptional({ description: 'Data do 1º lançamento (default: próximo vencimento calculado).' })
  @IsOptional() @IsDateString()
  proximaGeracao?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;
}

export class AtualizarRecorrenciaDto extends TenantAwareDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  fornecedorId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  valor?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  valorVariavel?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  planoContasCodigo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1) @Max(31)
  diaVencimento?: number;

  @ApiPropertyOptional({ enum: PeriodicidadeRecorrencia })
  @IsOptional() @IsEnum(PeriodicidadeRecorrencia)
  periodicidade?: PeriodicidadeRecorrencia;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  proximaGeracao?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;
}
