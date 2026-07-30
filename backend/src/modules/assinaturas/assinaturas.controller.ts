import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MinLength, Max, Min, ValidateNested } from 'class-validator';
import { AssinaturasService } from './assinaturas.service';
import { Public, CurrentTenant } from '../../common/decorators/context.decorator';
import { TenantAwareDto } from '../../common/dto/tenant-aware.dto';

class AddonsDto extends TenantAwareDto {
  @IsOptional() @IsInt() @Min(0) @Max(20)
  pdvs?: number;

  @IsOptional() @IsInt() @Min(0) @Max(50)
  usuarios?: number;

  @IsOptional() @IsInt() @Min(0) @Max(20)
  filiais?: number;
}

class CheckoutDto {
  @IsString() @IsNotEmpty()
  planoCodigo!: string; // ESSENCIAL | PROFISSIONAL | COMPLETO

  @IsOptional() @IsIn(['mensal', 'anual'])
  periodo?: 'mensal' | 'anual'; // padrão: mensal

  @IsString() @IsNotEmpty()
  razaoSocial!: string;

  @IsOptional() @IsString()
  nomeFantasia?: string;

  @IsString() @IsNotEmpty()
  cnpj!: string;

  @IsString() @IsNotEmpty()
  adminNome!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString() @MinLength(6)
  adminSenha!: string;

  @IsOptional() @IsEmail()
  emailCobranca?: string;

  @IsOptional() @ValidateNested() @Type(() => AddonsDto)
  addons?: AddonsDto;
}

/**
 * Endpoints públicos do funil self-service (sem autenticação):
 *   GET  /planos                     → catálogo para a página de preços
 *   POST /assinaturas/checkout       → compra: provisiona + inicia cobrança MP
 *   POST /assinaturas/webhook        → notificações do Mercado Pago
 * E um autenticado:
 *   GET  /assinaturas/me             → status da assinatura do tenant logado
 */
@Controller()
export class AssinaturasController {
  constructor(private readonly assinaturas: AssinaturasService) {}

  @Public()
  @Get('planos')
  listarPlanos() {
    return this.assinaturas.listarPlanos();
  }

  @Public()
  @Get('assinaturas/addons')
  listarAddons() {
    return this.assinaturas.listarAddons();
  }

  @Public()
  @Post('assinaturas/checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.assinaturas.checkout(dto);
  }

  @Public()
  @Post('assinaturas/webhook')
  webhook(@Body() body: any, @Req() req: any) {
    // O MP pode enviar dados no corpo e/ou na query (?topic=&id=).
    const merged = { ...body, ...req.query };
    return this.assinaturas.processarWebhook(merged);
  }

  @Get('assinaturas/me')
  meu(@CurrentTenant() tenantId: string) {
    return this.assinaturas.statusDoTenant(tenantId);
  }

  @Patch('assinaturas/me/addons')
  alterarAddons(@CurrentTenant() tenantId: string, @Body() dto: AddonsDto) {
    return this.assinaturas.alterarAddons(tenantId, dto);
  }
}
