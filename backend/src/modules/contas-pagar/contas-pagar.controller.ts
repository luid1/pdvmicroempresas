import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContasPagarService, ListarPagarDto } from './contas-pagar.service';
import { CriarPagarDto, BaixarPagarDto, CancelarPagarDto } from './dto/contas-pagar.dto';
import { CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

/** Contexto mínimo do usuário autenticado (montado no JwtStrategy). */
interface ReqUser {
  id: string;
  nome?: string;
}

@ApiTags('ContasPagar')
@ApiBearerAuth()
@Controller('contas-pagar')
export class ContasPagarController {
  constructor(private service: ContasPagarService) {}

  @Get()
  @ApiOperation({ summary: 'Lista títulos a pagar (com filtros de status/período).' })
  findAll(@CurrentTenant() tenantId: string, @Query() filtros: ListarPagarDto) {
    return this.service.findAll(tenantId, filtros);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'KPIs consolidados de Contas a Pagar.' })
  resumo(@CurrentTenant() tenantId: string, @Query() filtros: ListarPagarDto) {
    return this.service.resumo(tenantId, filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um título e sua trilha de auditoria.' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria título(s) a pagar, com parcelamento opcional.' })
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Body() dto: CriarPagarDto,
  ) {
    return this.service.create(tenantId, { id: user.id, nome: user.nome }, dto);
  }

  @Patch(':id/baixar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Baixa (pagamento) total/parcial. Requer FINANCEIRO:OPERAR.' })
  baixar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Param('id') id: string,
    @Body() dto: BaixarPagarDto,
  ) {
    return this.service.baixar(tenantId, { id: user.id, nome: user.nome }, id, dto);
  }

  @Patch(':id/cancelar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Cancela um título em aberto. Requer FINANCEIRO:OPERAR.' })
  cancelar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: ReqUser,
    @Param('id') id: string,
    @Body() body: CancelarPagarDto,
  ) {
    return this.service.cancelar(tenantId, { id: user.id, nome: user.nome }, id, body?.motivo);
  }
}
