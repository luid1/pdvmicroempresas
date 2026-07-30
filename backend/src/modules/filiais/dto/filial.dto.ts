import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, ValidateIf } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class CreateFilialDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'nome é obrigatório.' })
  nome: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  codigo?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  ie?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  tipo?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  regimeTributario?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  crt?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  responsavel?: string | null;

  @ApiPropertyOptional() @IsOptional()
  capacidadePaletes?: number | string | null;

  @ApiPropertyOptional() @IsOptional()
  ocupacaoPaletes?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  camaraFria?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  endereco?: Record<string, any> | null;
}

export class UpdateFilialDto extends PartialType(CreateFilialDto) {}

export class UpdateRegimeFilialDto extends TenantAwareDto {
  @ApiPropertyOptional({ nullable: true }) @optStr()
  regimeTributario?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  crt?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  ie?: string | null;
}
