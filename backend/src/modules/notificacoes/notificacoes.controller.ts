import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificacoesService, NotifUserCtx } from './notificacoes.service';
import { CriarNotificacaoDto } from './dto/notificacao.dto';
import { CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private service: NotificacoesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as notificações visíveis ao usuário atual.' })
  listar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: NotifUserCtx,
    @Query('naoLidas') naoLidas?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listar(tenantId, user, {
      apenasNaoLidas: naoLidas === 'true' || naoLidas === '1',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('nao-lidas')
  @ApiOperation({ summary: 'Contador de notificações não lidas (badge do sino).' })
  contar(@CurrentTenant() tenantId: string, @CurrentUser() user: NotifUserCtx) {
    return this.service.contarNaoLidas(tenantId, user);
  }

  @Post(':id/lida')
  @ApiOperation({ summary: 'Marca uma notificação como lida.' })
  marcarLida(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: NotifUserCtx,
    @Param('id') id: string,
  ) {
    return this.service.marcarLida(tenantId, user, id);
  }

  @Post('marcar-todas-lidas')
  @ApiOperation({ summary: 'Marca todas as notificações do usuário como lidas.' })
  marcarTodasLidas(@CurrentTenant() tenantId: string, @CurrentUser() user: NotifUserCtx) {
    return this.service.marcarTodasLidas(tenantId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma notificação.' })
  remover(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remover(tenantId, id);
  }

  @Post()
  @UseGuards(PermissoesGuard)
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  @ApiOperation({ summary: 'Cria uma notificação manual (avisos internos).' })
  criar(@CurrentTenant() tenantId: string, @Body() dto: CriarNotificacaoDto) {
    return this.service.criar(tenantId, dto);
  }

  @Post('gerar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  @ApiOperation({ summary: 'Dispara os geradores de alerta manualmente (varredura).' })
  gerar(@CurrentTenant() tenantId: string) {
    return this.service.gerarAlertas(tenantId);
  }
}
