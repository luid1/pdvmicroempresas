import {
  IsString,
  IsInt,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrigemComanda, EtapaKds } from '@prisma/client';

// ── Mesas ──
export class CriarMesaDto {
  @IsString() filialId!: string;
  @IsInt() @Min(1) numero!: number;
  @IsOptional() @IsString() @MaxLength(60) apelido?: string;
  @IsOptional() @IsInt() @Min(1) lugares?: number;
  @IsOptional() @IsInt() posX?: number;
  @IsOptional() @IsInt() posY?: number;
}

export class AtualizarMesaDto {
  @IsOptional() @IsInt() @Min(1) numero?: number;
  @IsOptional() @IsString() @MaxLength(60) apelido?: string;
  @IsOptional() @IsInt() @Min(1) lugares?: number;
  @IsOptional() @IsInt() posX?: number;
  @IsOptional() @IsInt() posY?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// ── Itens da comanda ──
export class ItemComandaInputDto {
  @IsOptional() @IsString() produtoId?: string;
  @IsString() @MaxLength(120) descricao!: string;
  @IsNumber() @Min(0.001) quantidade!: number;
  @IsNumber() @Min(0) precoUnitario!: number;
  @IsOptional() @IsString() @MaxLength(180) observacao?: string;
}

// ── Comandas ──
export class AbrirComandaDto {
  @IsString() filialId!: string;
  @IsOptional() @IsEnum(OrigemComanda) origem?: OrigemComanda;
  @IsOptional() @IsString() mesaId?: string;
  @IsOptional() @IsString() @MaxLength(120) clienteNome?: string;
  @IsOptional() @IsInt() @Min(1) pessoas?: number;
  @IsOptional() @IsString() garcomId?: string;
  @IsOptional() @IsString() @MaxLength(80) garcomNome?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemComandaInputDto)
  itens?: ItemComandaInputDto[];
}

export class AdicionarItensDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemComandaInputDto)
  itens!: ItemComandaInputDto[];
}

export class FecharComandaDto {
  @IsOptional() @IsNumber() @Min(0) taxaServico?: number; // valor em R$ (ex.: 10% já calculado)
  @IsOptional() @IsBoolean() aplicarTaxa10?: boolean; // se true, calcula 10% do subtotal
  @IsOptional() @IsNumber() @Min(0) desconto?: number;
  @IsOptional() @IsString() formaPagamento?: string;
  @IsOptional() @IsString() @MaxLength(240) observacoes?: string;
}

// ── KDS ──
export class MoverEtapaKdsDto {
  @IsEnum(EtapaKds) etapa!: EtapaKds;
}
