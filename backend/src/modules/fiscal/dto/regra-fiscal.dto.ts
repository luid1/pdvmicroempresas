import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, ValidateIf } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

// Decimais/inteiros podem chegar como string do formulário; o service normaliza com Number().
const optNumLike = () => (t: object, k: string) => {
  IsOptional()(t, k);
};

const optBool = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null && v !== undefined)(t, k);
  IsBoolean()(t, k);
};

export class CreateRegraFiscalDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'descrição é obrigatória.' })
  descricao: string;

  @ApiPropertyOptional({ nullable: true }) @optStr() ncm?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() ufDestino?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() tipoOperacao?: string | null;
  @ApiPropertyOptional() @optBool() consumidorFinal?: boolean | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() cfopInterno?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() cfopInterestadual?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr() cstIcms?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() origemProd?: string | null;
  @ApiPropertyOptional() @optNumLike() aliquotaIcms?: number | string;
  @ApiPropertyOptional() @optNumLike() reducaoBaseIcms?: number | string;

  @ApiPropertyOptional() @optBool() temSt?: boolean;
  @ApiPropertyOptional() @optNumLike() mvaSt?: number | string;
  @ApiPropertyOptional() @optNumLike() aliquotaIcmsSt?: number | string;

  @ApiPropertyOptional() @optBool() temDifal?: boolean;

  @ApiPropertyOptional({ nullable: true }) @optStr() cstIpi?: string | null;
  @ApiPropertyOptional() @optNumLike() aliquotaIpi?: number | string;

  @ApiPropertyOptional({ nullable: true }) @optStr() cstPis?: string | null;
  @ApiPropertyOptional() @optNumLike() aliquotaPis?: number | string;
  @ApiPropertyOptional({ nullable: true }) @optStr() cstCofins?: string | null;
  @ApiPropertyOptional() @optNumLike() aliquotaCofins?: number | string;

  @ApiPropertyOptional() @optNumLike() prioridade?: number | string;
  @ApiPropertyOptional() @optBool() ativo?: boolean;
}

export class UpdateRegraFiscalDto extends PartialType(CreateRegraFiscalDto) {}
