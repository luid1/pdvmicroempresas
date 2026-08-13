import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  IsIn,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

const optNum = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null && v !== undefined && v !== '')(t, k);
  IsNumber({ maxDecimalPlaces: 6 }, { message: `${k} deve ser numérico.` })(t, k);
};

export class ItemPedidoDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'produtoId do item é obrigatório.' })
  produtoId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  descricao?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade do item deve ser numérica.' })
  quantidade: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  unidade?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'precoUnitario do item deve ser numérico.' })
  precoUnitario: number;

  @ApiPropertyOptional({ enum: ['VALOR', 'PERCENT'] })
  @IsOptional() @IsIn(['VALOR', 'PERCENT'])
  descontoTipo?: 'VALOR' | 'PERCENT';

  @ApiPropertyOptional() @optNum()
  descontoPercent?: number;

  @ApiPropertyOptional() @optNum()
  desconto?: number;
}

export class CreatePedidoDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialOrigemId é obrigatório.' })
  filialOrigemId: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'clienteId é obrigatório.' })
  clienteId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  tipo?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataEmissao?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataEntrega?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  periodo?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  regiao?: string | null;

  @ApiPropertyOptional() @optNum()
  volumes?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  formaPagamento?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  condicaoPagamento?: string | null;

  @ApiPropertyOptional() @optNum()
  numeroParcelas?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  tipoFrete?: string | null;

  @ApiPropertyOptional() @optNum()
  valorFrete?: number;

  @ApiPropertyOptional() @optNum()
  descontoTotal?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoesNf?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  enderecoEntregaJson?: Record<string, any> | null;

  @ApiPropertyOptional({ type: [ItemPedidoDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ItemPedidoDto)
  itens?: ItemPedidoDto[];
}

export class UpdatePedidoDto extends PartialType(CreatePedidoDto) {}

export class ReposicaoItemDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'produtoId do item é obrigatório.' })
  produtoId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  descricao?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  unidade?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade do item deve ser numérica.' })
  quantidade: number;
}

export class ReposicaoDto extends TenantAwareDto {
  @ApiPropertyOptional({ type: [ReposicaoItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReposicaoItemDto)
  itens?: ReposicaoItemDto[];

  @ApiPropertyOptional({ nullable: true }) @optStr()
  motivo?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;
}

export class SepararItemDto extends TenantAwareDto {
  @ApiPropertyOptional() @optNum()
  pesoAferido?: number;

  @ApiPropertyOptional() @optNum()
  quantidadeSeparada?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  separado?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  cortado?: boolean;
}

export class UpdateStatusDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'status é obrigatório.' })
  status: string;
}
