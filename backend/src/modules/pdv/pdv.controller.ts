import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PdvService } from './pdv.service';
import { SessaoCaixaService } from './sessao-caixa.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';
import {
  RegistrarVendaDto,
  AbrirSessaoDto,
  MovimentoCaixaDto,
  FecharSessaoDto,
} from './dto/pdv.dto';

@ApiTags('PDV')
@ApiBearerAuth()
@Modulo('PEDIDOS')
@Controller('pdv')
export class PdvController {
  constructor(
    private service: PdvService,
    private sessao: SessaoCaixaService,
  ) {}

  @Get('produto')
  @RequirePermissao('PEDIDOS:READ')
  @ApiOperation({ summary: 'Buscar produto por código de barras / código interno' })
  buscarProduto(
    @CurrentTenant() tenantId: string,
    @Query('codigo') codigo: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.buscarProduto(tenantId, codigo, filialId);
  }

  @Get('produtos')
  @RequirePermissao('PEDIDOS:READ')
  @ApiOperation({ summary: 'Buscar produtos por nome/código (autocomplete do caixa)' })
  buscarProdutos(
    @CurrentTenant() tenantId: string,
    @Query('termo') termo: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.buscarProdutos(tenantId, termo, filialId);
  }

  @Post('venda')
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Registrar venda de frente de caixa (baixa estoque + entrada no caixa)' })
  registrarVenda(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: RegistrarVendaDto,
  ) {
    return this.service.registrarVenda(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Get('vendas')
  @RequirePermissao('PEDIDOS:READ')
  @ApiOperation({ summary: 'Últimas vendas da filial (reimpressão/estorno)' })
  vendasRecentes(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('limite') limite?: string,
  ) {
    return this.service.vendasRecentes(tenantId, filialId, limite ? Number(limite) : 20);
  }

  @Get('venda/:id/cupom')
  @RequirePermissao('PEDIDOS:READ')
  @ApiOperation({ summary: 'Dados do cupom de uma venda (reimpressão)' })
  reimprimirCupom(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.reimprimirCupom(tenantId, id);
  }

  @Post('venda/:id/estornar')
  @RequirePermissao('PEDIDOS:CANCELAR')
  @ApiOperation({ summary: 'Estornar venda (devolve estoque + reverte caixa) — exige permissão de gerente' })
  estornarVenda(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.service.estornarVenda(tenantId, { id: user.id, nome: user.nome }, id);
  }

  // ─────────────── Sessão / turno de caixa ───────────────

  @Get('sessao/atual')
  @RequirePermissao('PEDIDOS:READ')
  @ApiOperation({ summary: 'Sessão de caixa aberta do operador (ou null)' })
  sessaoAtual(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Query('filialId') filialId?: string,
  ) {
    return this.sessao.sessaoAtual(tenantId, user.id, filialId);
  }

  @Post('sessao/abrir')
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Abrir caixa (informar fundo de troco)' })
  abrirSessao(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: AbrirSessaoDto,
  ) {
    return this.sessao.abrir(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Post('sessao/sangria')
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Sangria (retirar dinheiro da gaveta)' })
  sangria(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: MovimentoCaixaDto,
  ) {
    return this.sessao.sangria(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Post('sessao/suprimento')
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Suprimento (reforço de troco na gaveta)' })
  suprimento(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: MovimentoCaixaDto,
  ) {
    return this.sessao.suprimento(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Post('sessao/fechar')
  @RequirePermissao('PEDIDOS:CREATE')
  @ApiOperation({ summary: 'Fechar caixa (conferência) + relatório Z' })
  fecharSessao(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: FecharSessaoDto,
  ) {
    return this.sessao.fechar(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Get('sessao/:id/relatorio')
  @RequirePermissao('PEDIDOS:READ')
  @ApiOperation({ summary: 'Relatório X (parcial) ou Z (fechamento) da sessão' })
  relatorio(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.sessao.relatorio(tenantId, id);
  }
}
