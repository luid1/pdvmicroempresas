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
import { RecorrenciasService } from './recorrencias.service';
import { CriarRecorrenciaDto, AtualizarRecorrenciaDto } from './dto/recorrencia.dto';
import { CurrentTenant } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Recorrências')
@ApiBearerAuth()
@Controller('recorrencias')
export class RecorrenciasController {
  constructor(private service: RecorrenciasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista despesas recorrentes.' })
  listar(@CurrentTenant() tenantId: string, @Query('ativo') ativo?: string) {
    const filtro = ativo === undefined ? undefined : ativo === 'true';
    return this.service.listar(tenantId, filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma despesa recorrente.' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Prevê as próximas ocorrências (sem gerar).' })
  preview(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('quantidade') quantidade?: string,
  ) {
    return this.service.preview(tenantId, id, quantidade ? parseInt(quantidade, 10) : 6);
  }

  @Post()
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Cria uma despesa recorrente.' })
  criar(@CurrentTenant() tenantId: string, @Body() dto: CriarRecorrenciaDto) {
    return this.service.criar(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Atualiza uma despesa recorrente.' })
  atualizar(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AtualizarRecorrenciaDto,
  ) {
    return this.service.atualizar(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Remove uma despesa recorrente.' })
  remover(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remover(tenantId, id);
  }

  @Post('gerar')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:OPERAR')
  @ApiOperation({ summary: 'Dispara manualmente a geração das recorrências vencidas.' })
  gerar(@CurrentTenant() tenantId: string) {
    return this.service.gerarDevidas(tenantId);
  }
}
