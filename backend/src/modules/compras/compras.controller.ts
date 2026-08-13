import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ComprasService } from './compras.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';
import { CreateOrdemCompraDto, UpdateOrdemCompraDto, MudarStatusOrdemCompraDto, ReceberOrdemCompraDto } from './dto/compra.dto';

@ApiTags('Compras')
@ApiBearerAuth()
@Modulo('ESTOQUE')
@Controller('compras')
export class ComprasController {
  constructor(private service: ComprasService) {}

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(tenantId, { status, fornecedorId, search });
  }

  @Get('produto/:produtoId/historico')
  @ApiOperation({ summary: 'Histórico de compras de um produto (últimas OCs que o incluíram)' })
  historicoProduto(@CurrentTenant() tenantId: string, @Param('produtoId') produtoId: string) {
    return this.service.historicoProduto(tenantId, produtoId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissao('ESTOQUE:CREATE')
  @ApiOperation({ summary: 'Cria uma Ordem de Compra' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateOrdemCompraDto) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @RequirePermissao('ESTOQUE:UPDATE')
  @ApiOperation({ summary: 'Edita uma OC (recalcula totais)' })
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateOrdemCompraDto) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissao('ESTOQUE:DELETE')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }

  @Patch(':id/status')
  @RequirePermissao('ESTOQUE:UPDATE')
  @ApiOperation({ summary: 'Muda o status da OC (ENTREGUE dá entrada no estoque + contas a pagar)' })
  mudarStatus(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: MudarStatusOrdemCompraDto) {
    return this.service.mudarStatus(tenantId, id, dto.status as any, user.id);
  }

  @Post(':id/receber')
  @RequirePermissao('ESTOQUE:UPDATE')
  @ApiOperation({ summary: 'Recebe a OC (total ou parcial): gera entrada de mercadoria + estoque + contas a pagar' })
  receber(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReceberOrdemCompraDto) {
    return this.service.receber(tenantId, id, user.id, dto);
  }
}
