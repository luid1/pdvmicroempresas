import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsArray, IsObject, ValidateIf } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class CreateUsuarioDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'nome é obrigatório.' })
  nome: string;

  @ApiProperty()
  @IsEmail({}, { message: 'e-mail inválido.' })
  email: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'senha é obrigatória.' })
  senha: string;

  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'roleId (perfil) é obrigatório.' })
  roleId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  cpf?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  filialIds?: string[];
}

export class UpdateUsuarioDto extends PartialType(OmitType(CreateUsuarioDto, ['senha'] as const)) {}

export class ResetSenhaDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'senha é obrigatória.' })
  senha: string;
}

export class CreateRoleDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'nome do perfil é obrigatório.' })
  nome: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  descricao?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  telas?: string[];

  @ApiPropertyOptional({ nullable: true }) @optStr()
  telaInicial?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  acoes?: Record<string, any> | null;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
