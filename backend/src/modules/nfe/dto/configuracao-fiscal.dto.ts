import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

export class SalvarConfiguracaoFiscalDto extends TenantAwareDto {
  @IsString() @IsIn(['FOCUS_NFE', 'BUGGY', 'OUTRO'])
  provedor: 'FOCUS_NFE' | 'BUGGY' | 'OUTRO';

  @IsString() @IsIn(['HOMOLOGACAO', 'PRODUCAO'])
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';

  @IsBoolean()
  ativo: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  baseUrl?: string;

  @IsOptional() @IsString() @MaxLength(500)
  token?: string;

  @IsOptional() @IsBoolean()
  removerToken?: boolean;

  @IsOptional() @IsString() @MaxLength(30)
  cscId?: string;

  @IsOptional() @IsString() @MaxLength(500)
  csc?: string;

  @IsOptional() @IsBoolean()
  removerCsc?: boolean;

  @IsOptional() @IsString() @MaxLength(10)
  serieNfe?: string;

  @IsOptional() @IsString() @MaxLength(10)
  serieNfce?: string;

  @IsOptional() @IsObject()
  configPublica?: Record<string, unknown>;
}
