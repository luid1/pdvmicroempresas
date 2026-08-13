import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
  IsPositive,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class ItemEntradaDto {
  @ApiPropertyOptional({ nullable: true }) @optStr()
  produtoId?: string | null;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'descrição do item é obrigatória.' })
  descricao: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  ncm?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade do item deve ser numérica.' })
  @IsPositive({ message: 'quantidade do item deve ser maior que zero.' })
  quantidade: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  unidade?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'valorUnitario do item deve ser numérico.' })
  @Min(0, { message: 'valorUnitario do item não pode ser negativo.' })
  valorUnitario: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'valorTotal do item deve ser numérico.' })
  @Min(0, { message: 'valorTotal do item não pode ser negativo.' })
  valorTotal?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  loteNumero?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataValidade?: string | null;
}

export class CreateEntradaDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'fornecedorId é obrigatório.' })
  fornecedorId: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialId de destino é obrigatório.' })
  filialId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  ordemCompraId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  chaveNfeEntrada?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  xmlOriginal?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  numeroNf?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  serieNf?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataEmissao?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  gerarContaPagar?: boolean;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataVencimento?: string | null;

  @ApiProperty({ type: [ItemEntradaDto] })
  @IsArray() @ArrayNotEmpty({ message: 'Informe ao menos um item.' })
  @ValidateNested({ each: true }) @Type(() => ItemEntradaDto)
  itens: ItemEntradaDto[];
}
