import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  IsBoolean,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

export class ItemVendaPdvDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'produtoId do item é obrigatório.' })
  produtoId: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'quantidade deve ser numérica.' })
  quantidade: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'precoUnit deve ser numérico.' })
  precoUnit: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  unidade?: string;
}

export class AbrirSessaoDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialId é obrigatório.' })
  filialId: string;

  @ApiPropertyOptional({ description: 'Fundo de troco inicial na gaveta.' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  saldoInicial?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;
}

export class MovimentoCaixaDto extends TenantAwareDto {
  @ApiProperty({ description: 'Valor da sangria/suprimento (positivo).' })
  @IsNumber({ maxDecimalPlaces: 2 })
  valor: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  descricao?: string;
}

export class FecharSessaoDto extends TenantAwareDto {
  @ApiProperty({ description: 'Dinheiro contado na gaveta pelo operador.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  saldoFinalInformado: number;

  @ApiPropertyOptional({ description: 'Total de cartão conferido na maquininha.' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  cartaoInformado?: number;

  @ApiPropertyOptional({ description: 'Total de PIX conferido na maquininha.' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  pixInformado?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observacoes?: string;
}

/** Formas de pagamento aceitas. As variantes _TEF/_POS distinguem máquina
 *  integrada (TEF) de maquininha avulsa (POS). Para totais/gaveta, o que vale
 *  é a categoria: DINHEIRO, CARTAO ou PIX. */
export const FORMAS_PAGAMENTO = [
  'DINHEIRO',
  'CARTAO', 'CARTAO_TEF', 'CARTAO_POS',
  'CARTAO_CREDITO', 'CARTAO_DEBITO',
  'PIX', 'PIX_TEF', 'PIX_POS',
] as const;
export type FormaPagamentoPdv = (typeof FORMAS_PAGAMENTO)[number];

export class PagamentoPdvDto {
  @ApiProperty({ enum: FORMAS_PAGAMENTO })
  @IsIn(FORMAS_PAGAMENTO as unknown as string[], { message: 'forma de pagamento inválida.' })
  forma: string;

  @ApiProperty({ description: 'Valor abatido do total nesta forma.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valor do pagamento deve ser numérico.' })
  valor: number;

  @ApiPropertyOptional({ description: 'Dinheiro entregue pelo cliente (só p/ DINHEIRO, calcula troco).' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  valorRecebido?: number;

  @ApiPropertyOptional({ description: 'Bandeira do cartão (TEF/POS).' })
  @IsOptional() @IsString()
  bandeira?: string;

  @ApiPropertyOptional({ description: 'NSU do comprovante TEF.' })
  @IsOptional() @IsString()
  nsu?: string;

  @ApiPropertyOptional({ description: 'Código de autorização TEF.' })
  @IsOptional() @IsString()
  autorizacao?: string;
}

export class RegistrarVendaDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialId é obrigatório.' })
  filialId: string;

  @ApiPropertyOptional({
    enum: FORMAS_PAGAMENTO,
    description: 'Forma única (compat.). Prefira "pagamentos" p/ pagamento dividido.',
  })
  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO as unknown as string[], { message: 'formaPagamento inválida.' })
  formaPagamento?: string;

  @ApiPropertyOptional({ description: 'Valor entregue pelo cliente (dinheiro) — forma única.' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  valorRecebido?: number;

  @ApiPropertyOptional({ type: [PagamentoPdvDto], description: 'Pagamento dividido em várias formas.' })
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagamentoPdvDto)
  pagamentos?: PagamentoPdvDto[];

  @ApiPropertyOptional({ description: 'Desconto sobre o total da venda, já resolvido em R$.' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }, { message: 'desconto deve ser numérico.' })
  desconto?: number;

  @ApiPropertyOptional({ enum: ['VALOR', 'PERCENT'], description: 'Como o desconto foi informado (para o cupom/auditoria).' })
  @IsOptional() @IsIn(['VALOR', 'PERCENT'], { message: 'descontoTipo inválido.' })
  descontoTipo?: string;

  @ApiPropertyOptional({ description: 'Percentual do desconto (quando informado em %).' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 })
  descontoPercent?: number;

  @ApiPropertyOptional({ description: 'CPF/CNPJ do consumidor na nota fiscal (opcional).' })
  @IsOptional() @IsString()
  cpfNota?: string;

  @ApiProperty({ type: [ItemVendaPdvDto] })
  @IsArray() @ArrayNotEmpty({ message: 'A venda precisa de ao menos um item.' })
  @ValidateNested({ each: true })
  @Type(() => ItemVendaPdvDto)
  itens: ItemVendaPdvDto[];
}

/** Autorização de supervisor/fiscal para operações sensíveis do caixa
 *  (estorno, cancelamento, sangria acima do limite). */
export class AutorizacaoSupervisorDto extends TenantAwareDto {
  @ApiProperty({ description: 'E-mail do supervisor/fiscal que autoriza.' })
  @IsString() @IsNotEmpty({ message: 'Informe o e-mail do supervisor.' })
  email: string;

  @ApiProperty({ description: 'Senha do supervisor/fiscal.' })
  @IsString() @IsNotEmpty({ message: 'Informe a senha do supervisor.' })
  senha: string;

  @ApiPropertyOptional({ description: 'Ação que está sendo autorizada (para auditoria).' })
  @IsOptional() @IsString()
  acao?: string;
}

/** Autorização por SENHA GERENCIAL interna da loja (modelo simples do mercadinho,
 *  sem e-mail/lookup externo). Valida contra a ConfiguracaoCaixa da filial. */
export class AutorizacaoGerencialDto extends TenantAwareDto {
  @ApiProperty({ description: 'Filial/loja em que a operação ocorre.' })
  @IsString() @IsNotEmpty({ message: 'Informe a filial.' })
  filialId: string;

  @ApiProperty({ description: 'Senha gerencial interna da loja.' })
  @IsString() @IsNotEmpty({ message: 'Informe a senha gerencial.' })
  senha: string;

  @ApiPropertyOptional({ description: 'Ação que está sendo autorizada (para auditoria).' })
  @IsOptional() @IsString()
  acao?: string;
}

/** Configuração do caixa por loja: senha gerencial interna + quais operações
 *  exigem senha. Todos os campos de exigência são opcionais no update (só os
 *  enviados são alterados). `senhaGerencial` em branco NÃO altera a senha atual. */
export class ConfigCaixaDto extends TenantAwareDto {
  @ApiProperty({ description: 'Filial/loja da configuração.' })
  @IsString() @IsNotEmpty({ message: 'Informe a filial.' })
  filialId: string;

  @ApiPropertyOptional({ description: 'Nova senha gerencial (em branco = mantém a atual).' })
  @IsOptional() @IsString()
  senhaGerencial?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaCancelarVenda?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaRemoverItem?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaDesconto?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaSangria?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaSuprimento?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaFecharCaixa?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  senhaEstorno?: boolean;
}
