import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevolucoesCompraService } from './devolucoes-compra.service';
import { CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

interface ReqUser {
  id: string;
  nome?: string;
}

@ApiTags('Devoluções de Compra')
@ApiBearerAuth()
@Controller('devolucoes-compra')
export class DevolucoesCompraController {
  constructor(private service: DevolucoesCompraService) {}

  @Get()
  @ApiOperation({ summary: 'Lista devoluções de compra ao fornecedor.' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(tenantId, { fornecedorId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma devolução de compra.' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissoesGuard)
  @RequirePermissao('ESTOQUE:OPERAR')
  @ApiOperation({ summary: 'Registra devolução ao fornecedor: baixa estoque + estorna a pagar.' })
  create(@CurrentTenant() tenantId: string, @CurrentUser() user: ReqUser, @Body() dto: any) {
    return this.service.create(tenantId, user.id, dto);
  }
}
