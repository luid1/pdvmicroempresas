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
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

// ── Mesas ──
export class CriarMesaDto extends TenantAwareDto {
  @IsString() filialId!: string;
  @IsInt() @Min(1) numero!: number;
  @IsOptional() @IsString() @MaxLength(60) apelido?: string;
  @IsOptional() @IsInt() @Min(1) lugares?: number;
  @IsOptional() @IsInt() posX?: number;
  @IsOptional() @IsInt() posY?: number;
}

export class AtualizarMesaDto extends TenantAwareDto {
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
  // Etapa inicial no KDS. Omitido → FILA (vai pra cozinha). Bebidas/itens prontos
  // podem vir como ENTREGUE para lançar direto na conta, sem passar pela cozinha.
  @IsOptional() @IsEnum(EtapaKds) etapaKds?: EtapaKds;
}

// ── Comandas ──
export class AbrirComandaDto extends TenantAwareDto {
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

export class AdicionarItensDto extends TenantAwareDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemComandaInputDto)
  itens!: ItemComandaInputDto[];
}

export class FecharComandaDto extends TenantAwareDto {
  @IsOptional() @IsNumber() @Min(0) taxaServico?: number; // valor em R$ (ex.: 10% já calculado)
  @IsOptional() @IsBoolean() aplicarTaxa10?: boolean; // se true, calcula 10% do subtotal
  @IsOptional() @IsNumber() @Min(0) desconto?: number;
  @IsOptional() @IsString() formaPagamento?: string;
  @IsOptional() @IsString() @MaxLength(240) observacoes?: string;
}

// ── KDS ──
export class MoverEtapaKdsDto extends TenantAwareDto {
  @IsEnum(EtapaKds) etapa!: EtapaKds;
}
