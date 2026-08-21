import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { PlataformaService } from './plataforma.service';
import { AtualizarLojaDto, CriarLojaDto, ToggleFilialDto } from './dto/plataforma.dto';

/**
 * Painel do DONO DA PLATAFORMA (SaaS) — CROSS-TENANT.
 *
 * Protegido pelo SuperAdminGuard LOCAL (roda depois do JwtAuthGuard global).
 * O super-admin já passa livre pelo TenantInterceptor / FilialGuard / PlanoGateGuard,
 * então aqui ele opera qualquer loja (tenant) e qualquer filial.
 */
@ApiTags('Plataforma (SaaS)')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('plataforma')
export class PlataformaController {
  constructor(private service: PlataformaService) {}

  @Get('lojas')
  @ApiOperation({ summary: 'Lista todas as lojas (tenants) com contadores e assinatura' })
  listarLojas(@Query('q') q?: string, @Query('status') status?: string) {
    return this.service.listarLojas({ q, status });
  }

  @Post('lojas')
  @ApiOperation({ summary: 'Cria uma loja nova (tenant + filial matriz + admin master)' })
  criarLoja(@Body() dto: CriarLojaDto) {
    return this.service.criarLoja(dto);
  }

  @Get('lojas/:id')
  @ApiOperation({ summary: 'Detalhe de uma loja: dados, filiais, usuários e assinatura' })
  obterLoja(@Param('id') id: string) {
    return this.service.obterLoja(id);
  }

  @Patch('lojas/:id')
  @ApiOperation({ summary: 'Atualiza cadastro da loja (ativo:false = desativar)' })
  atualizarLoja(@Param('id') id: string, @Body() dto: AtualizarLojaDto) {
    return this.service.atualizarLoja(id, dto);
  }

  @Post('lojas/:id/filiais')
  @ApiOperation({ summary: 'Cadastra uma filial na loja alvo' })
  adicionarFilial(@Param('id') id: string, @Body() dto: any) {
    return this.service.adicionarFilial(id, dto);
  }

  @Put('filiais/:id')
  @ApiOperation({ summary: 'Atualiza uma filial de qualquer loja' })
  atualizarFilial(@Param('id') id: string, @Body() dto: any) {
    return this.service.atualizarFilial(id, dto);
  }

  @Patch('filiais/:id/toggle')
  @ApiOperation({ summary: 'Ativa/desativa uma filial (soft-delete)' })
  toggleFilial(@Param('id') id: string, @Body() dto: ToggleFilialDto) {
    return this.service.toggleFilial(id, dto.ativo);
  }
}
