import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { AbrirInventarioDto, ContarItemDto } from './dto/inventario.dto';

@ApiTags('Inventario')
@ApiBearerAuth()
@Modulo('ESTOQUE')
@Controller('inventario')
export class InventarioController {
  constructor(private service: InventarioService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Abre um inventário (congela o saldo do sistema)' })
  abrir(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Body() dto: AbrirInventarioDto) {
    return this.service.abrir(tenantId, user.id, dto);
  }

  @Patch('item/:itemId/contar')
  @ApiOperation({ summary: 'Grava a contagem física de um item' })
  contar(@CurrentTenant() tenantId: string, @Param('itemId') itemId: string, @Body() dto: ContarItemDto) {
    return this.service.contar(tenantId, itemId, dto.quantidadeContada);
  }

  @Post(':id/fechar')
  @ApiOperation({ summary: 'Fecha o inventário e gera os ajustes de estoque' })
  fechar(@CurrentTenant() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    return this.service.fechar(tenantId, user.id, id);
  }
}
