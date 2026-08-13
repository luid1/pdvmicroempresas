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

export class CreateClienteDto extends TenantAwareDto {
  @ApiPropertyOptional({ enum: ['PF', 'PJ'], default: 'PJ' })
  @IsOptional() @IsIn(['PF', 'PJ'])
  tipo?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'Razão social / nome é obrigatório.' }) @MaxLength(200)
  razaoSocial: string;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(200)
  nomeFantasia?: string | null;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'CNPJ/CPF é obrigatório.' }) @MaxLength(18)
  cnpjCpf: string;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(20)
  ie?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(20)
  im?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(120)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(20)
  telefone?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(20)
  celular?: string | null;

  @ApiPropertyOptional({ description: 'Endereço: rua, numero, bairro, cidade, uf, cep' })
  @IsOptional() @IsObject()
  enderecoJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Contato: nome, cargo, telefone' })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  contatoJson?: Record<string, any> | null;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  limiteCredito?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  prazoMedio?: number;

  @ApiPropertyOptional({ nullable: true }) @optStr() @MaxLength(30)
  tabelaPreco?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  observacoes?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  exigeRastreabilidade?: boolean;
}

export class UpdateClienteDto extends PartialType(CreateClienteDto) {}
