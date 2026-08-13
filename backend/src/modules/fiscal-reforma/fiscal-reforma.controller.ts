import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FiscalReformaService } from './fiscal-reforma.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';

/**
 * Módulo Fiscal Centralizado — Reforma Tributária (IBS/CBS).
 * Rotas expostas sob /api/v1/fiscal-reforma.
 */
@ApiTags('Fiscal — Reforma Tributária (IBS/CBS)')
@ApiBearerAuth()
@Modulo('FISCAL')
@Controller('fiscal-reforma')
export class FiscalReformaController {
  constructor(private service: FiscalReformaService) {}

  @Post('calcular-venda')
  @ApiOperation({ summary: 'Calcula IBS/CBS de uma venda (item a item + consolidado)' })
  calcularVenda(
    @CurrentTenant() tenantId: string,
    @Body('itens') itens: { produto_id: string; quantidade: number; preco_unitario?: number }[],
  ) {
    return this.service.calcularVenda(tenantId, itens);
  }

  @Post('faturar')
  @ApiOperation({
    summary:
      'Fatura um pedido: cálculo IBS/CBS + NF-e (mensageria simulada) + 3 lançamentos financeiros automáticos (Receita, Provisão IBS, Provisão CBS)',
  })
  faturar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: { pedido_id: string; data_vencimento?: string },
  ) {
    return this.service.faturar(tenantId, user.id, dto);
  }

  @Post('devolver')
  @ApiOperation({
    summary: 'Devolve uma venda: NF-e de estorno + anula contas a receber + cancela provisões IBS/CBS + auditoria',
  })
  devolver(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: { pedido_id: string; motivo?: string },
  ) {
    return this.service.devolver(tenantId, user.id, dto);
  }

  @Get('auditoria')
  @ApiOperation({ summary: 'Trilha de auditoria fiscal (emissões, estornos, alterações)' })
  auditoria(@CurrentTenant() tenantId: string, @Query('limite') limite?: string) {
    return this.service.auditoria(tenantId, Number(limite) || 100);
  }
}
