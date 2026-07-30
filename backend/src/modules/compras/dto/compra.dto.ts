import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  IsPositive,
  Min,
  ValidateIf,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class ItemOrdemCompraDto {
  @ApiPropertyOptional({ nullable: true }) @optStr()
  produtoId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  descricao?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  unidade?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidade do item deve ser numérica.' })
  @IsPositive({ message: 'quantidade do item deve ser maior que zero.' })
  quantidade: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'precoUnitario do item deve ser numérico.' })
  @Min(0, { message: 'precoUnitario do item não pode ser negativo.' })
  precoUnitario: number;
}

export class CreateOrdemCompraDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'fornecedorId é obrigatório.' })
  fornecedorId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  filialId?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  condicaoPagamento?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataEntregaPrevista?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiProperty({ type: [ItemOrdemCompraDto] })
  @IsArray() @ArrayNotEmpty({ message: 'Informe ao menos um item.' })
  @ValidateNested({ each: true }) @Type(() => ItemOrdemCompraDto)
  itens: ItemOrdemCompraDto[];
}

export class UpdateOrdemCompraDto extends PartialType(CreateOrdemCompraDto) {}

export class ItemRecebimentoDto {
  @ApiProperty({ description: 'ID do ItemOrdemCompra sendo recebido.' })
  @IsString() @IsNotEmpty({ message: 'itemId é obrigatório.' })
  itemId: string;

  @ApiProperty({ description: 'Quantidade recebida nesta remessa.' })
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidadeRecebida deve ser numérica.' })
  @IsPositive({ message: 'quantidadeRecebida deve ser maior que zero.' })
  quantidadeRecebida: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  loteNumero?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  dataValidade?: string | null;
}

export class ReceberOrdemCompraDto extends TenantAwareDto {
  @ApiPropertyOptional({
    type: [ItemRecebimentoDto],
    description: 'Itens e quantidades recebidas. Se omitido, recebe o saldo pendente de todos os itens.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true }) @Type(() => ItemRecebimentoDto)
  itens?: ItemRecebimentoDto[];
}

export class MudarStatusOrdemCompraDto extends TenantAwareDto {
  @ApiProperty({ enum: ['PENDENTE', 'APROVADA', 'PARCIAL', 'ENTREGUE', 'CANCELADA'] })
  @IsString() @IsNotEmpty({ message: 'status é obrigatório.' })
  @IsIn(['PENDENTE', 'APROVADA', 'PARCIAL', 'ENTREGUE', 'CANCELADA'], { message: 'status inválido.' })
  status: string;
}
