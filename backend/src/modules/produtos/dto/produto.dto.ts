import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

/**
 * Campo numérico tolerante: o frontend envia número ou null (campo vazio).
 * @IsOptional permite ausência; @ValidateIf ignora null; @IsNumber valida o resto.
 */
const OptionalNumber = () => (target: object, key: string) => {
  IsOptional()(target, key);
  ValidateIf((_, v) => v !== null && v !== undefined && v !== '')(target, key);
  IsNumber({ maxDecimalPlaces: 6 }, { message: `${key} deve ser numérico.` })(target, key);
};

export class CreateProdutoDto extends TenantAwareDto {
  @ApiProperty({ example: 'BANANA PRATA' })
  @IsString()
  @IsNotEmpty({ message: 'A descrição do produto é obrigatória.' })
  @MaxLength(200)
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(60)
  codigo?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  codigoBarras?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(8)
  ncm?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(10)
  cfop?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  categoria?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  grupo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  marca?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  classificacao?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  tipoCaixaria?: string | null;

  @ApiPropertyOptional({ description: 'Sigla da unidade de medida (KG, UN, PC...)' })
  @IsOptional() @IsString() @MaxLength(10)
  unidadeSigla?: string;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  pesoCaixaria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  pesoLiquido?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  pesoBruto?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  precoVenda?: number | null;
}

/** Update aceita todos os campos do create (parciais) + composição analítica de custo. */
export class UpdateProdutoDto extends PartialType(CreateProdutoDto) {
  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  precoCusto?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  custoBase?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  custoAliquotaImp?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  custoEmbalagem?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  custoFrete?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  custoChapa?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalNumber()
  fatorPerdaPct?: number | null;
}
