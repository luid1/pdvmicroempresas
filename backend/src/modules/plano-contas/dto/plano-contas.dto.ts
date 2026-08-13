import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { TipoLancamento } from '@prisma/client';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

/** Criação de uma conta do plano. */
export class CriarPlanoContaDto extends TenantAwareDto {
  @ApiProperty({ example: '3.4.08' })
  @IsString() @IsNotEmpty({ message: 'codigo é obrigatório.' })
  codigo: string;

  @ApiProperty({ example: 'Marketing e Publicidade' })
  @IsString() @IsNotEmpty({ message: 'descricao é obrigatória.' })
  descricao: string;

  @ApiProperty({ enum: TipoLancamento })
  @IsEnum(TipoLancamento, { message: 'tipo deve ser DEBITO ou CREDITO.' })
  tipo: TipoLancamento;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: '1=grupo, 2=subgrupo, 3=analítica' })
  @IsOptional() @IsInt() @Min(1) @Max(5)
  nivel?: number;

  @ApiPropertyOptional({ description: 'Código da conta pai (ex.: 3.4).' })
  @IsOptional() @IsString()
  pai?: string;

  @ApiPropertyOptional({ description: 'Se true, aceita lançamentos diretos.' })
  @IsOptional() @IsBoolean()
  analitica?: boolean;
}

/** Atualização parcial de uma conta (código é imutável). */
export class AtualizarPlanoContaDto extends TenantAwareDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  descricao?: string;

  @ApiPropertyOptional({ enum: TipoLancamento })
  @IsOptional() @IsEnum(TipoLancamento)
  tipo?: TipoLancamento;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  analitica?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;
}
