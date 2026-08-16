import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsEnum, ValidateIf, ValidateNested, ArrayMinSize, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoMovimentacao } from '@prisma/client';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class AjusteEstoqueDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialId é obrigatório.' })
  filialId: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'produtoId é obrigatório.' })
  produtoId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  loteId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  localizacaoId?: string | null;

  @ApiProperty({ enum: TipoMovimentacao })
  @IsEnum(TipoMovimentacao, { message: 'tipo de movimentação inválido.' })
  tipo: TipoMovimentacao;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade deve ser numérica.' })
  quantidade: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 6 })
  custoUnitario?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  permitirNegativo?: boolean;
}

/**
 * Cadastro de lote com validade (aba de perecíveis): cria/reaproveita um Lote
 * do produto e dá entrada da quantidade no estoque da filial.
 */
export class RegistrarLoteDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'produtoId é obrigatório.' })
  produtoId: string;

  @ApiProperty({ description: 'Quantidade que entra em estoque neste lote.' })
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade deve ser numérica.' })
  quantidade: number;

  @ApiProperty({ description: 'Data de validade (ISO: 2026-12-31).' })
  @IsString() @IsNotEmpty({ message: 'dataValidade é obrigatória.' })
  dataValidade: string;

  @ApiPropertyOptional({ description: 'Número do lote. Se vazio, gerado a partir da validade.' })
  @IsOptional() @IsString()
  numero?: string;

  @ApiPropertyOptional({ description: 'Data de fabricação (ISO).' })
  @IsOptional() @IsString()
  dataFabricacao?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 6 })
  custoUnitario?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;
}

export class TransferenciaEstoqueDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialOrigemId é obrigatório.' })
  filialOrigemId: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialDestinoId é obrigatório.' })
  filialDestinoId: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'produtoId é obrigatório.' })
  produtoId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  loteId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  localizacaoOrigemId?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade deve ser numérica.' })
  quantidade: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;
}

export class ItemNovaTransferenciaDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  produtoId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  loteId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  localizacaoOrigemId?: string | null;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001)
  quantidade: number;
}

export class NovaTransferenciaDto extends TenantAwareDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  filialOrigemId: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  filialDestinoId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiProperty({ type: [ItemNovaTransferenciaDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemNovaTransferenciaDto)
  itens: ItemNovaTransferenciaDto[];
}

export class ItemRecebimentoTransferenciaDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  itemId: string;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  quantidadeRecebida: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacaoDivergencia?: string | null;
}

export class ReceberTransferenciaDto extends TenantAwareDto {
  @ApiProperty({ type: [ItemRecebimentoTransferenciaDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemRecebimentoTransferenciaDto)
  itens: ItemRecebimentoTransferenciaDto[];
}

export class CancelarTransferenciaDto extends TenantAwareDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  motivo: string;
}
