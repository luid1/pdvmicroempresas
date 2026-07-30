import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

/** Criação manual de um título a receber (com parcelamento opcional). */
export class CriarReceberDto extends TenantAwareDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  clienteId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  filialId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  pedidoId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  nfeId?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'descricao é obrigatória.' })
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  numero?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valorTotal deve ser numérico.' })
  @IsPositive({ message: 'valorTotal deve ser maior que zero.' })
  valorTotal: number;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString({}, { message: 'dataCompetencia deve ser uma data válida.' })
  dataCompetencia?: string;

  @ApiProperty()
  @IsDateString({}, { message: 'dataVencimento deve ser uma data válida.' })
  dataVencimento: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1, { message: 'parcelas deve ser >= 1.' })
  parcelas?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1, { message: 'intervaloDias deve ser >= 1.' })
  intervaloDias?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  formaPagamento?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;
}

/** Baixa (recebimento) total ou parcial de um título. */
export class BaixarReceberDto extends TenantAwareDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valor deve ser numérico.' })
  @IsPositive({ message: 'valor deve ser maior que zero.' })
  valor: number;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString({}, { message: 'dataPagamento deve ser uma data válida.' })
  dataPagamento?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  valorDesconto?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  valorJuros?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  formaPagamento?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;

  @ApiPropertyOptional({ description: 'Conta financeira creditada (gera MovimentoCaixa de entrada).' })
  @IsOptional() @IsString()
  contaId?: string;
}

/** Cancelamento de um título em aberto. */
export class CancelarReceberDto extends TenantAwareDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  motivo?: string;
}
