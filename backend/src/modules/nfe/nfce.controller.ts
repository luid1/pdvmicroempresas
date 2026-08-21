import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NfceService } from './nfce.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';

@ApiTags('NFC-e')
@ApiBearerAuth()
@Modulo('NFE')
@Controller('nfce')
export class NfceController {
  constructor(private service: NfceService) {}

  @Get('status')
  @ApiOperation({ summary: 'Retorna se a emissão de NFC-e está habilitada e em qual modo' })
  status() {
    const modo = (process.env.NFCE_MODO || 'desligado').toLowerCase();
    return { habilitado: this.service.habilitado(), modo };
  }

  @Get('monitor')
  @ApiOperation({ summary: 'Monitor Fiscal: documentos com status, pendências e vínculo com a venda' })
  monitor(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('status') status?: string,
    @Query('busca') busca?: string,
    @Query('dias') dias?: string,
  ) {
    return this.service.listarMonitor(tenantId, {
      filialId,
      status,
      busca,
      dias: dias ? Number(dias) : undefined,
    });
  }

  @Get('monitor/resumo')
  @ApiOperation({ summary: 'Resumo do Monitor Fiscal (contadores por status)' })
  resumo(@CurrentTenant() tenantId: string, @Query('filialId') filialId?: string) {
    return this.service.resumoMonitor(tenantId, filialId);
  }

  @Get('documento/:id')
  @ApiOperation({ summary: 'Detalhe de uma NFC-e (modelo 65) com itens' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post('emitir-de-pedido/:pedidoId')
  @ApiOperation({ summary: 'Emite NFC-e (modelo 65) a partir de uma venda/pedido do PDV' })
  emitirDePedido(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('pedidoId') pedidoId: string,
    @Body('filialId') filialId: string,
    @Body('cpfNota') cpfNota?: string,
  ) {
    return this.service.emitirDePedido(tenantId, pedidoId, filialId, user.id, { cpfNota });
  }

  @Post('documento/:id/transmitir')
  @ApiOperation({ summary: 'Reenvia ao SEFAZ um documento pendente/contingência' })
  transmitir(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.transmitir(tenantId, id);
  }

  @Post('documento/:id/consultar')
  @ApiOperation({ summary: 'Consulta o status real no SEFAZ e reconcilia (aprovada? cancelada?)' })
  consultar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.consultarStatus(tenantId, id);
  }

  @Post('documento/:id/cancelar')
  @ApiOperation({ summary: 'Cancela uma NFC-e autorizada no SEFAZ' })
  cancelar(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('motivo') motivo?: string,
  ) {
    return this.service.cancelarNfce(tenantId, id, motivo);
  }

  @Post('reprocessar')
  @ApiOperation({ summary: 'Reenvia todos os documentos pendentes/contingência (fila de reenvio)' })
  reprocessar(@CurrentTenant() tenantId: string, @Body('filialId') filialId?: string) {
    return this.service.reprocessarPendentes(tenantId, filialId);
  }
}
