import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { CurrentTenant, Modulo, AuditEntidade } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Clientes')
@ApiBearerAuth()
@Modulo('CADASTROS')
@AuditEntidade('Cliente', 'cliente')
@UseGuards(PermissoesGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private service: ClientesService) {}

  @Post()
  @RequirePermissao('CADASTROS:CREATE')
  @ApiOperation({ summary: 'Cadastrar cliente' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateClienteDto) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes' })
  findAll(@CurrentTenant() tenantId: string, @Query('search') search?: string) {
    return this.service.findAll(tenantId, search);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Put(':id')
  @RequirePermissao('CADASTROS:UPDATE')
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissao('CADASTROS:DELETE')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
