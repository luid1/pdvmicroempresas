import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';
import { TipoContaFinanceira, TipoMovimento } from '@prisma/client';

/** Criação de uma conta financeira (caixa / banco / cartão / aplicação). */
export class CriarContaFinanceiraDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'nome é obrigatório.' })
  nome: string;

  @ApiPropertyOptional({ enum: TipoContaFinanceira })
  @IsOptional() @IsEnum(TipoContaFinanceira)
  tipo?: TipoContaFinanceira;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  filialId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  banco?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  agencia?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  documento?: string;

  @ApiPropertyOptional({ description: 'Saldo inicial da conta (default 0).' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  saldoInicial?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  padrao?: boolean;
}

/** Atualização de uma conta financeira (não altera saldoAtual diretamente). */
export class AtualizarContaFinanceiraDto extends TenantAwareDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  nome?: string;

  @ApiPropertyOptional({ enum: TipoContaFinanceira })
  @IsOptional() @IsEnum(TipoContaFinanceira)
  tipo?: TipoContaFinanceira;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  banco?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  agencia?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  documento?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  padrao?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

/** Lançamento avulso de caixa (entrada ou saída manual, sem título). */
export class MovimentoAvulsoDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'contaId é obrigatório.' })
  contaId: string;

  @ApiProperty({ enum: TipoMovimento })
  @IsEnum(TipoMovimento, { message: 'tipo deve ser ENTRADA ou SAIDA.' })
  tipo: TipoMovimento;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valor deve ser numérico.' })
  @IsPositive({ message: 'valor deve ser maior que zero.' })
  valor: number;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'descricao é obrigatória.' })
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  data?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  filialId?: string;

  @ApiPropertyOptional({ description: 'Categoria (código do plano de contas).' })
  @IsOptional() @IsString()
  planoContasCodigo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;
}

/** Transferência entre duas contas financeiras (gera 2 movimentos ligados). */
export class TransferenciaDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'contaOrigemId é obrigatório.' })
  contaOrigemId: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'contaDestinoId é obrigatório.' })
  contaDestinoId: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valor deve ser numérico.' })
  @IsPositive({ message: 'valor deve ser maior que zero.' })
  valor: number;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  data?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  descricao?: string;
}

/** Uma linha do extrato OFX enviado para importação/conciliação. */
export class ItemOFXDto {
  @ApiProperty()
  @IsDateString()
  data: string;

  @ApiProperty({ description: 'Valor com sinal: positivo entrada, negativo saída.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  valor: number;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  documento?: string;

  @ApiPropertyOptional({ description: 'FITID do OFX (idempotência).' })
  @IsOptional() @IsString()
  fitId?: string;
}

/** Importação de extrato bancário (já parseado do OFX no frontend ou backend). */
export class ImportarExtratoDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'contaId é obrigatório.' })
  contaId: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  arquivo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  periodoInicio?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  periodoFim?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  saldoFinal?: number;

  @ApiProperty({ type: [ItemOFXDto] })
  itens: ItemOFXDto[];
}

/** Conciliação: vincula um item do extrato a um movimento de caixa existente. */
export class ConciliarDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'itemExtratoId é obrigatório.' })
  itemExtratoId: string;

  @ApiPropertyOptional({ description: 'Movimento existente a vincular. Se ausente, cria um AJUSTE.' })
  @IsOptional() @IsString()
  movimentoId?: string;

  @ApiPropertyOptional({ description: 'Categoria ao criar movimento de ajuste.' })
  @IsOptional() @IsString()
  planoContasCodigo?: string;
}
