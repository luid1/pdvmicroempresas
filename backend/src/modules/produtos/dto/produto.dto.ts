import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
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

const OptionalString = (max = 120) => (target: object, key: string) => {
  IsOptional()(target, key);
  ValidateIf((_, v) => v !== null)(target, key);
  IsString()(target, key);
  MaxLength(max)(target, key);
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

  @ApiPropertyOptional({ nullable: true }) @OptionalString(60)
  codigoBarrasSecun?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(60)
  codigoBarrasCaixa?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(60)
  gtinTributavel?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(80)
  skuFornecedor?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(80)
  referencia?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(120)
  fabricante?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(500)
  descricaoCompleta?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(120)
  descricaoFiscal?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(8)
  ncm?: string;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(10)
  cest?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(4)
  exTipi?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(20)
  codigoBeneficioFiscal?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(4)
  generoItem?: string | null;

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

  @ApiPropertyOptional({ nullable: true }) @OptionalString(60)
  subgrupo?: string | null;

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

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  precoCompra?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  estoqueMinimo?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  estoqueMaximo?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  estoqueSeguranca?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  pontoReposicao?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  quantidadeEmbalagem?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  multiploCompra?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  alturaCm?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  larguraCm?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  comprimentoCm?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(80)
  localizacaoPadrao?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  leadTimeDias?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requerLote?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requerValidade?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  vendidoPorPeso?: boolean;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(3)
  cstIcms?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(3)
  cstPis?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(3)
  cstCofins?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  aliquotaIcms?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  aliquotaPis?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  aliquotaCofins?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(3)
  cstIbsCbs?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalString(6)
  classTribIbsCbs?: string | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  aliquotaIbsUf?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  aliquotaIbsMun?: number | null;

  @ApiPropertyOptional({ nullable: true }) @OptionalNumber()
  aliquotaCbs?: number | null;
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
