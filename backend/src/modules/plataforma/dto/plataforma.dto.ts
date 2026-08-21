import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, MinLength, MaxLength,
} from 'class-validator';

/** Cria uma nova loja (tenant) + filial matriz + usuário admin master. */
export class CriarLojaDto {
  @ApiProperty({ description: 'Razão social da empresa' })
  @IsString() @IsNotEmpty({ message: 'Razão social é obrigatória.' }) @MaxLength(200)
  razaoSocial: string;

  @ApiPropertyOptional({ description: 'Nome fantasia (opcional)' })
  @IsOptional() @IsString() @MaxLength(200)
  nomeFantasia?: string;

  @ApiProperty({ description: 'CNPJ da empresa' })
  @IsString() @IsNotEmpty({ message: 'CNPJ é obrigatório.' }) @MinLength(11) @MaxLength(18)
  cnpj: string;

  @ApiPropertyOptional({ description: 'Regime tributário', example: 'SIMPLES_NACIONAL' })
  @IsOptional() @IsString()
  regimeTributario?: string;

  @ApiProperty({ description: 'Nome do administrador master da loja' })
  @IsString() @IsNotEmpty({ message: 'Nome do administrador é obrigatório.' }) @MaxLength(120)
  adminNome: string;

  @ApiProperty({ example: 'admin@empresa.com.br' })
  @IsEmail({}, { message: 'E-mail do admin inválido.' }) @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({ description: 'Senha do admin master' })
  @IsString() @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres.' }) @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: 'Nome da filial matriz (padrão: nome fantasia/razão social)' })
  @IsOptional() @IsString() @MaxLength(120)
  filialNome?: string;

  @ApiPropertyOptional({ description: 'Código da filial matriz (padrão: 0001)' })
  @IsOptional() @IsString() @MaxLength(20)
  filialCodigo?: string;
}

/** Atualiza os dados cadastrais da loja (tenant). Toggling `ativo` = ativar/desativar. */
export class AtualizarLojaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  razaoSocial?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  nomeFantasia?: string;

  @ApiPropertyOptional({ description: 'Ativa (true) ou desativa (false) a loja inteira' })
  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  plano?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  regimeTributario?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  ie?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  emailNfe?: string;
}

/** Ativa/desativa uma filial específica de uma loja. */
export class ToggleFilialDto {
  @ApiProperty({ description: 'Novo estado da filial' })
  @IsBoolean()
  ativo: boolean;
}
