import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrecificacaoService } from './precificacao.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Precificação')
@ApiBearerAuth()
@Controller('precificacao')
export class PrecificacaoController {
  constructor(private service: PrecificacaoService) {}

  @Get('tabelas')
  @ApiOperation({ summary: 'Lista os preços cadastrados por tabela.' })
  listar(
    @CurrentTenant() tenantId: string,
    @Query('produtoId') produtoId?: string,
    @Query('tabela') tabela?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listar(tenantId, { produtoId, tabela, search });
  }

  @Get('resolver')
  @ApiOperation({ summary: 'Resolve o preço de um produto para uma tabela/cliente.' })
  resolver(
    @CurrentTenant() tenantId: string,
    @Query('produtoId') produtoId: string,
    @Query('tabela') tabela?: string,
    @Query('clienteId') clienteId?: string,
    @Query('data') data?: string,
  ) {
    return this.service.resolverPreco(tenantId, produtoId, { tabela, clienteId, data });
  }

  @Post('resolver-lote')
  @ApiOperation({ summary: 'Resolve preços de vários produtos (montagem de pedido).' })
  resolverLote(
    @CurrentTenant() tenantId: string,
    @Body() dto: { produtoIds: string[]; tabela?: string; clienteId?: string; data?: string },
  ) {
    return this.service.resolverLote(tenantId, dto.produtoIds || [], {
      tabela: dto.tabela,
      clienteId: dto.clienteId,
      data: dto.data,
    });
  }

  @Post('tabelas')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('CADASTROS:OPERAR')
  @ApiOperation({ summary: 'Cria/atualiza o preço de um produto numa tabela.' })
  upsert(@CurrentTenant() tenantId: string, @Body() dto: any) {
    return this.service.upsert(tenantId, dto);
  }

  @Delete('tabelas/:id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('CADASTROS:OPERAR')
  @ApiOperation({ summary: 'Remove um preço de tabela.' })
  remover(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remover(tenantId, id);
  }
}
