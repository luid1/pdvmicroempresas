import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatusComanda } from '@prisma/client';
import { RestauranteService } from './restaurante.service';
import {
  CriarMesaDto,
  AtualizarMesaDto,
  AbrirComandaDto,
  AdicionarItensDto,
  FecharComandaDto,
  MoverEtapaKdsDto,
} from './dto/restaurante.dto';
import { CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

interface ReqUser {
  id: string;
  nome?: string;
}

@ApiTags('Restaurante')
@ApiBearerAuth()
@Controller('restaurante')
export class RestauranteController {
  constructor(private service: RestauranteService) {}

  // ── Mesas ──
  @Get('mesas')
  @ApiOperation({ summary: 'Lista as mesas do salão (por filial).' })
  listarMesas(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('incluirInativas') incluirInativas?: string,
  ) {
    return this.service.listarMesas(tenantId, filialId, incluirInativas === 'true');
  }

  @Post('mesas')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('CADASTROS:CREATE')
  @ApiOperation({ summary: 'Cria uma mesa.' })
  criarMesa(@CurrentTenant() tenantId: string, @Body() dto: CriarMesaDto) {
    return this.service.criarMesa(tenantId, dto);
  }

  @Patch('mesas/:id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('CADASTROS:UPDATE')
  @ApiOperation({ summary: 'Atualiza uma mesa.' })
  atualizarMesa(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AtualizarMesaDto,
  ) {
    return this.service.atualizarMesa(tenantId, id, dto);
  }

  @Delete('mesas/:id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('CADASTROS:DELETE')
  @ApiOperation({ summary: 'Inativa uma mesa (soft delete).' })
  removerMesa(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.removerMesa(tenantId, id);
  }

  // ── Comandas ──
  @Get('comandas')
  @ApiOperation({ summary: 'Lista comandas (filtros: filial, status, mesa).' })
  listarComandas(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('status') status?: StatusComanda,
    @Query('mesaId') mesaId?: string,
  ) {
    return this.service.listarComandas(tenantId, { filialId, status, mesaId });
  }

  @Get('comandas/:id')
  @ApiOperation({ summary: 'Detalha uma comanda com seus itens.' })
  getComanda(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.getComanda(tenantId, id);
  }

  @Post('comandas')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Abre uma comanda (mesa/balcão/delivery).' })
  abrirComanda(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Body() dto: AbrirComandaDto,
  ) {
    return this.service.abrirComanda(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Post('comandas/:id/itens')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Lança itens numa comanda aberta.' })
  adicionarItens(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AdicionarItensDto,
  ) {
    return this.service.adicionarItens(tenantId, id, dto);
  }

  @Delete('comandas/:id/itens/:itemId')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Remove um item de uma comanda aberta.' })
  removerItem(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removerItem(tenantId, id, itemId);
  }

  @Post('comandas/:id/pedir-conta')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Pede a conta: comanda → fechando, mesa → conta.' })
  pedirConta(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.pedirConta(tenantId, id);
  }

  @Post('comandas/:id/fechar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Fecha a conta (taxa/desconto), libera a mesa.' })
  fecharComanda(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: FecharComandaDto,
  ) {
    return this.service.fecharComanda(tenantId, id, dto);
  }

  @Post('comandas/:id/cancelar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:CANCELAR')
  @ApiOperation({ summary: 'Cancela uma comanda (não paga), libera a mesa.' })
  cancelarComanda(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.cancelarComanda(tenantId, id);
  }

  // ── KDS (cozinha) ──
  @Get('kds')
  @ApiOperation({ summary: 'Fila da cozinha agrupada por etapa (FILA/PREPARO/PRONTO).' })
  listarKds(@CurrentTenant() tenantId: string, @Query('filialId') filialId?: string) {
    return this.service.listarKds(tenantId, filialId);
  }

  @Patch('kds/:itemId')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('PEDIDOS:UPDATE')
  @ApiOperation({ summary: 'Move um item de etapa na cozinha.' })
  moverEtapaKds(
    @CurrentTenant() tenantId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MoverEtapaKdsDto,
  ) {
    return this.service.moverEtapaKds(tenantId, itemId, dto.etapa);
  }
}
