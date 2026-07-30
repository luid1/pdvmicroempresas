import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedorDto, UpdateFornecedorDto } from './dto/fornecedor.dto';
import { CurrentTenant, Modulo, AuditEntidade } from '../../common/decorators/context.decorator';
import { PermissoesGuard } from '../../common/guards/permissoes.guard';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Fornecedores')
@ApiBearerAuth()
@Modulo('CADASTROS')
@AuditEntidade('Fornecedor', 'fornecedor')
@UseGuards(PermissoesGuard)
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private service: FornecedoresService) {}

  @Post()
  @RequirePermissao('CADASTROS:CREATE')
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateFornecedorDto) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string, @Query('search') search?: string, @Query('tipoParceria') tipoParceria?: string) {
    return this.service.findAll(tenantId, search, tipoParceria);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Put(':id')
  @RequirePermissao('CADASTROS:UPDATE')
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateFornecedorDto) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissao('CADASTROS:DELETE')
  @ApiOperation({ summary: 'Remove fornecedor' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
