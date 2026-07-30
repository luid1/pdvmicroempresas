import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { EntradasService } from './entradas.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';
import { CreateEntradaDto } from './dto/entrada.dto';

@ApiTags('Entradas')
@ApiBearerAuth()
@Modulo('ESTOQUE')
@Controller('entradas')
export class EntradasController {
  constructor(private service: EntradasService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.findAll(tenantId, { status, search });
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissao('ESTOQUE:CREATE')
  @ApiOperation({ summary: 'Registra entrada de mercadoria (dá entrada no estoque + lote/validade)' })
  create(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Body() dto: CreateEntradaDto) {
    return this.service.create(tenantId, user.id, dto);
  }
}
