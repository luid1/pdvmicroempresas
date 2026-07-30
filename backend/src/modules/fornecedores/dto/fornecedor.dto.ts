import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsIn,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class CreateFornecedorDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'Razão social / nome é obrigatório.' }) @MaxLength(200)
  razaoSocial: string;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(200)
  nomeFantasia?: string | null;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'CNPJ/CPF é obrigatório.' }) @MaxLength(18)
  cnpj: string;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(20)
  ie?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(120)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(20)
  telefone?: string | null;

  @ApiPropertyOptional({ description: 'Endereço: cidade, uf, ...' })
  @IsOptional() @IsObject()
  enderecoJson?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  contatoJson?: Record<string, any> | null;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  prazoEntrega?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(30)
  inscricaoRural?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(120)
  localizacaoPropriedade?: string | null;

  @ApiPropertyOptional({ enum: ['COMPRA_DIRETA', 'CONSIGNACAO'], default: 'COMPRA_DIRETA' })
  @IsOptional() @IsIn(['COMPRA_DIRETA', 'CONSIGNACAO'])
  tipoParceria?: string;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(120)
  pix?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  dadosBancarios?: Record<string, any> | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class UpdateFornecedorDto extends PartialType(CreateFornecedorDto) {}
