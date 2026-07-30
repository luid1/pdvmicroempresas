import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'luid@hetros.com.br' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsNotEmpty({ message: 'E-mail é obrigatório.' })
  email: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MaxLength(128)
  password: string;
}

export class LoginPorIdDto {
  @ApiProperty({ description: 'ID do usuário selecionado na tela visual' })
  @IsString()
  @IsNotEmpty({ message: 'usuarioId é obrigatório.' })
  usuarioId: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MaxLength(128)
  password: string;
}

export class RegisterTenantDto {
  @ApiProperty({ description: 'Razão social da empresa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  razaoSocial: string;

  @ApiProperty({ description: 'CNPJ da empresa' })
  @IsString()
  @IsNotEmpty()
  @MinLength(11)
  @MaxLength(18)
  cnpj: string;

  @ApiPropertyOptional({ description: 'Regime tributário', example: 'SIMPLES_NACIONAL' })
  @IsOptional()
  @IsString()
  regimeTributario?: string;

  @ApiProperty({ description: 'Nome do administrador master' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  adminNome: string;

  @ApiProperty({ example: 'admin@empresa.com.br' })
  @IsEmail({}, { message: 'E-mail do admin inválido.' })
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({ description: 'Senha do admin master' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres.' })
  @MaxLength(128)
  password: string;

  @ApiProperty({ description: 'Nome da filial matriz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  filialNome: string;

  @ApiProperty({ description: 'Código da filial matriz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  filialCodigo: string;
}
