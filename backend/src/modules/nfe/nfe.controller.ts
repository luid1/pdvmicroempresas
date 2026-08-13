import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NFeService } from './nfe.service';
import { GerarNfeDto } from './dto/gerar-nfe.dto';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';

@ApiTags('NF-e')
@ApiBearerAuth()
@Modulo('NFE')
@Controller('nfe')
export class NFeController {
  constructor(private service: NFeService) {}

  @Get(':filialId')
  @ApiOperation({ summary: 'Lista NF-e da filial com filtros' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('status') status?: any,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.findAll(tenantId, filialId, {
      status,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  @Get('documento/:id')
  @ApiOperation({ summary: 'Detalhe de uma NF-e com itens' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post('gerar-de-pedido/:pedidoId')
  @ApiOperation({ summary: 'Gera NF-e rascunho a partir de um pedido faturável' })
  gerarDePedido(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('pedidoId') pedidoId: string,
    @Body() body: GerarNfeDto,
  ) {
    return this.service.gerarDesPedido(tenantId, pedidoId, body.filialId, user.id);
  }

  @Post(':id/emitir')
  @ApiOperation({ summary: 'Envia NF-e ao SEFAZ → baixa estoque + gera conta a receber automaticamente' })
  emitir(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.service.emitir(tenantId, id, user.id);
  }

  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancela NF-e no SEFAZ → estorna estoque + cancela títulos' })
  cancelar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('motivo') motivo: string,
  ) {
    return this.service.cancelar(tenantId, id, motivo, user.id);
  }

  // ---- Carta de Correção Eletrônica (CC-e) ----
  @Post(':id/carta-correcao')
  @ApiOperation({ summary: 'Registra uma Carta de Correção Eletrônica' })
  cce(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body('correcao') correcao: string) {
    return this.service.emitirCartaCorrecao(tenantId, id, correcao, user.id);
  }

  @Get(':id/cartas-correcao')
  @ApiOperation({ summary: 'Lista as CC-e de uma NF-e' })
  listarCce(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.listarCartasCorrecao(tenantId, id);
  }

  // ---- Nota Fiscal de Devolução ----
  @Post(':id/devolucao')
  @ApiOperation({ summary: 'Gera NF-e de devolução (espelho de entrada) a partir da nota original' })
  gerarDevolucao(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('itens') itens?: { itemNfeId: string; quantidade: number }[],
  ) {
    return this.service.gerarDevolucao(tenantId, id, user.id, itens);
  }

  @Post(':id/devolucao/emitir')
  @ApiOperation({ summary: 'Emite a NF-e de devolução → reentra estoque + anula financeiro' })
  emitirDevolucao(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.service.emitirDevolucao(tenantId, id, user.id);
  }
}
