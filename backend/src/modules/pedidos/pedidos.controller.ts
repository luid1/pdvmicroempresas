import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PedidosService } from './pedidos.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { CreatePedidoDto, UpdatePedidoDto, ReposicaoDto, SepararItemDto, UpdateStatusDto } from './dto/pedido.dto';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Pedidos')
@ApiBearerAuth()
@Modulo('PEDIDOS')
@UseGuards(PermissoesGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(private service: PedidosService) {}

  @Post()
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Criar pedido de venda' })
  create(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Body() dto: CreatePedidoDto) {
    return this.service.create(tenantId, { ...dto, usuarioId: user.id } as any);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pedidos com filtros' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('status') status?: string,
    @Query('clienteId') clienteId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(tenantId, { filialId, status, clienteId, dataInicio, dataFim, search });
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Put(':id')
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Editar pedido (rascunho)' })
  update(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdatePedidoDto) {
    return this.service.update(tenantId, id, { ...dto, usuarioId: user.id } as any);
  }

  @Patch(':id/confirmar')
  @RequirePermissao('PEDIDOS:APROVAR')
  @ApiOperation({ summary: 'Confirmar pedido' })
  confirmar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.confirmar(tenantId, id);
  }

  @Post(':id/reposicao')
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Gera uma reposição (grátis) a partir deste pedido' })
  reposicao(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReposicaoDto) {
    return this.service.criarReposicao(tenantId, user.id, id, dto);
  }

  @Patch(':id/reposicao/concluir')
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Conclui a reposição: baixa de estoque (perda) + lança a perda no financeiro' })
  concluirReposicao(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.service.concluirReposicao(tenantId, user.id, id);
  }

  @Patch(':id/cancelar')
  @RequirePermissao('PEDIDOS:CANCELAR')
  @ApiOperation({ summary: 'Cancelar pedido' })
  cancelar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.cancelar(tenantId, id);
  }

  @Patch(':id/status')
  @RequirePermissao('PEDIDOS:UPDATE')
  updateStatus(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(tenantId, id, dto.status);
  }

  @Patch(':id/itens/:itemId/separacao')
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Separação/pesagem de um item (peso aferido, conferência, corte)' })
  separarItem(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SepararItemDto,
  ) {
    return this.service.separarItem(tenantId, id, itemId, dto);
  }
}
