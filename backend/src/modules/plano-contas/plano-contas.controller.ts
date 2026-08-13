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
import { PlanoContasService } from './plano-contas.service';
import { CriarPlanoContaDto, AtualizarPlanoContaDto } from './dto/plano-contas.dto';
import { CurrentTenant } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('PlanoContas')
@ApiBearerAuth()
@Controller('plano-contas')
export class PlanoContasController {
  constructor(private service: PlanoContasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista o plano de contas (semeia o padrão se vazio).' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('incluirInativas') incluirInativas?: string,
  ) {
    return this.service.findAll(tenantId, incluirInativas === 'true');
  }

  @Get('analiticas')
  @ApiOperation({ summary: 'Só as contas analíticas (para selects de categoria).' })
  analiticas(@CurrentTenant() tenantId: string) {
    return this.service.analiticas(tenantId);
  }

  @Post('semear')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Restaura o plano de contas padrão (idempotente).' })
  semear(@CurrentTenant() tenantId: string) {
    return this.service.semear(tenantId);
  }

  @Post()
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Cria uma conta no plano. Requer FINANCEIRO:CONFIGURAR.' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CriarPlanoContaDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Edita uma conta do plano. Requer FINANCEIRO:CONFIGURAR.' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AtualizarPlanoContaDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissoesGuard)
  @RequirePermissao('FINANCEIRO:CONFIGURAR')
  @ApiOperation({ summary: 'Inativa uma conta (bloqueia se tiver lançamentos).' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
