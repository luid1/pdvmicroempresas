import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EstoqueService } from './estoque.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { AjusteEstoqueDto, TransferenciaEstoqueDto, RegistrarLoteDto, NovaTransferenciaDto, ReceberTransferenciaDto, CancelarTransferenciaDto } from './dto/estoque.dto';
import { StatusTransferenciaEstoque } from '@prisma/client';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Estoque/WMS')
@ApiBearerAuth()
@Modulo('ESTOQUE')
@UseGuards(PermissoesGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private service: EstoqueService) {}

  @Get('transferencias')
  @ApiOperation({ summary: 'Lista documentos de transferência entre filiais' })
  transferencias(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('status') status?: StatusTransferenciaEstoque,
  ) {
    return this.service.listarTransferencias(tenantId, { filialId, status });
  }

  @Get('transferencias/:id')
  @ApiOperation({ summary: 'Detalhe e rastreabilidade de uma transferência' })
  transferencia(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.obterTransferencia(tenantId, id);
  }

  @Post('transferencias')
  @RequirePermissao('ESTOQUE:CREATE')
  @ApiOperation({ summary: 'Solicita transferência de um ou mais produtos' })
  criarTransferencia(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Body() body: NovaTransferenciaDto) {
    return this.service.criarTransferencia(tenantId, user.id, body);
  }

  @Post('transferencias/:id/aprovar')
  @RequirePermissao('ESTOQUE:UPDATE')
  aprovarTransferencia(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.service.aprovarTransferencia(tenantId, id, user.id);
  }

  @Post('transferencias/:id/despachar')
  @RequirePermissao('ESTOQUE:UPDATE')
  despacharTransferencia(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.service.despacharTransferencia(tenantId, id, user.id);
  }

  @Post('transferencias/:id/receber')
  @RequirePermissao('ESTOQUE:UPDATE')
  receberTransferencia(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body() body: ReceberTransferenciaDto) {
    return this.service.receberTransferencia(tenantId, id, user.id, body.itens);
  }

  @Post('transferencias/:id/cancelar')
  @RequirePermissao('ESTOQUE:UPDATE')
  cancelarTransferencia(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body() body: CancelarTransferenciaDto) {
    return this.service.cancelarTransferencia(tenantId, id, user.id, body.motivo);
  }

  @Get(':filialId/saldo')
  @ApiOperation({ summary: 'Posição de estoque da filial (posição completa)' })
  @ApiQuery({ name: 'alertaValidade', required: false, type: Boolean })
  posicao(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('alertaValidade') alertaValidade?: string,
  ) {
    return this.service.getPosicaoGeral(tenantId, filialId, {
      alertaValidade: alertaValidade === 'true',
    });
  }

  @Get(':filialId/saldo/:produtoId')
  @ApiOperation({ summary: 'Saldo de um produto específico (por lote/localização)' })
  saldoProduto(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Param('produtoId') produtoId: string,
    @Query('loteId') loteId?: string,
  ) {
    return this.service.getSaldo(tenantId, filialId, produtoId, loteId);
  }

  @Get(':filialId/alertas-validade')
  @ApiOperation({ summary: 'FLV/Perecíveis vencendo nos próximos N dias' })
  alertasValidade(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('dias') dias?: string,
  ) {
    return this.service.getAlertasValidade(tenantId, filialId, dias ? Number(dias) : 5);
  }

  @Get(':filialId/lotes')
  @ApiOperation({ summary: 'Todos os lotes com validade da filial (aba de perecíveis)' })
  lotes(@CurrentTenant() tenantId: string, @Param('filialId') filialId: string) {
    return this.service.getLotes(tenantId, filialId);
  }

  @Post(':filialId/lote')
  @RequirePermissao('ESTOQUE:CREATE')
  @ApiOperation({ summary: 'Cadastrar lote com validade + entrada de estoque (perecíveis)' })
  registrarLote(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('filialId') filialId: string,
    @Body() body: RegistrarLoteDto,
  ) {
    return this.service.registrarLote(tenantId, filialId, user.id, body);
  }

  @Get(':filialId/fefo/:produtoId')
  @ApiOperation({ summary: 'Lotes do produto ordenados por validade (FEFO) — sugestão de separação' })
  fefo(@CurrentTenant() tenantId: string, @Param('filialId') filialId: string, @Param('produtoId') produtoId: string) {
    return this.service.getFefoLotes(tenantId, filialId, produtoId);
  }

  @Get(':filialId/analise')
  @ApiOperation({ summary: 'Análise de estoque físico (dados reais por produto no período)' })
  analise(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('dataIni') dataIni?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getAnaliseEstoque(tenantId, filialId, dataIni, dataFim);
  }

  @Get(':filialId/a-comprar')
  @ApiOperation({ summary: 'Produtos com estoque negativo ou abaixo do mínimo (a comprar/repor)' })
  aComprar(@CurrentTenant() tenantId: string, @Param('filialId') filialId: string) {
    return this.service.getAComprar(tenantId, filialId);
  }

  @Get(':filialId/perdas')
  @ApiOperation({ summary: 'Resumo de perdas e quebras (avarias) do período — qtd e valor R$' })
  resumoPerdas(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getResumoPerdas(tenantId, filialId, dataInicio, dataFim);
  }

  @Get(':filialId/movimentacoes')
  @ApiOperation({ summary: 'Extrato de movimentações da filial' })
  movimentacoes(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('produtoId') produtoId?: string,
    @Query('tipo') tipo?: any,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getMovimentacoes(tenantId, filialId, {
      produtoId,
      tipo,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  @Post('ajuste')
  @RequirePermissao('ESTOQUE:UPDATE')
  @ApiOperation({ summary: 'Ajuste manual de estoque (perda, avaria, inventário)' })
  ajuste(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Body() body: AjusteEstoqueDto) {
    return this.service.movimentar(tenantId, { ...body, usuarioId: user.id });
  }

  @Post('transferencia')
  @RequirePermissao('ESTOQUE:UPDATE')
  @ApiOperation({ summary: 'Transferência entre filiais/boxes' })
  transferir(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Body() body: TransferenciaEstoqueDto) {
    return this.service.transferir(tenantId, { ...body, usuarioId: user.id });
  }
}
