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
import { TesourariaService, ListarMovimentosDto } from './tesouraria.service';
import {
  CriarContaFinanceiraDto,
  AtualizarContaFinanceiraDto,
  MovimentoAvulsoDto,
  TransferenciaDto,
  ImportarExtratoDto,
  ConciliarDto,
} from './dto/tesouraria.dto';
import { CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

interface ReqUser {
  id: string;
  nome?: string;
}

@ApiTags('Tesouraria')
@ApiBearerAuth()
@Controller('tesouraria')
export class TesourariaController {
  constructor(private service: TesourariaService) {}

  // ── Contas financeiras ──
  @Get('contas')
  @ApiOperation({ summary: 'Lista contas financeiras (caixa/banco/cartão).' })
  listarContas(
    @CurrentTenant() tenantId: string,
    @Query('incluirInativas') incluirInativas?: string,
  ) {
    return this.service.listarContas(tenantId, incluirInativas === 'true');
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Saldo consolidado das contas + KPIs de conciliação.' })
  resumo(@CurrentTenant() tenantId: string) {
    return this.service.resumo(tenantId);
  }

  @Get('contas/:id')
  @ApiOperation({ summary: 'Detalha uma conta financeira.' })
  findConta(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findConta(tenantId, id);
  }

  @Post('contas')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Cria uma conta financeira.' })
  criarConta(@CurrentTenant() tenantId: string, @Body() dto: CriarContaFinanceiraDto) {
    return this.service.criarConta(tenantId, dto);
  }

  @Patch('contas/:id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Atualiza uma conta financeira.' })
  atualizarConta(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AtualizarContaFinanceiraDto,
  ) {
    return this.service.atualizarConta(tenantId, id, dto);
  }

  @Delete('contas/:id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Inativa (ou remove se zerada) uma conta financeira.' })
  removerConta(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.removerConta(tenantId, id);
  }

  // ── Movimentos ──
  @Get('movimentos')
  @ApiOperation({ summary: 'Lista movimentos de caixa (com filtros).' })
  listarMovimentos(@CurrentTenant() tenantId: string, @Query() filtros: ListarMovimentosDto) {
    return this.service.listarMovimentos(tenantId, filtros);
  }

  @Post('movimentos')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Lançamento avulso de caixa (entrada/saída).' })
  movimentoAvulso(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Body() dto: MovimentoAvulsoDto,
  ) {
    return this.service.movimentoAvulso(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Post('transferencias')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Transferência entre contas (gera 2 movimentos).' })
  transferencia(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Body() dto: TransferenciaDto,
  ) {
    return this.service.transferencia(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  // ── Conciliação (OFX) ──
  @Get('extratos')
  @ApiOperation({ summary: 'Lista extratos bancários importados.' })
  listarExtratos(@CurrentTenant() tenantId: string, @Query('contaId') contaId?: string) {
    return this.service.listarExtratos(tenantId, contaId);
  }

  @Get('extratos/:id/itens')
  @ApiOperation({ summary: 'Lista os itens (linhas) de um extrato.' })
  listarItensExtrato(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.listarItensExtrato(tenantId, id);
  }

  @Post('extratos/importar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Importa um extrato OFX (itens já parseados) + auto-concilia.' })
  importarExtrato(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Body() dto: ImportarExtratoDto,
  ) {
    return this.service.importarExtrato(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Post('conciliar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Concilia manualmente um item do extrato.' })
  conciliar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Body() dto: ConciliarDto,
  ) {
    return this.service.conciliar(tenantId, { id: user.id, nome: user.nome }, dto);
  }
}
