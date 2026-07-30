import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FluxoCaixaService, FluxoCaixaDto } from './fluxo-caixa.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';

@ApiTags('FluxoCaixa')
@ApiBearerAuth()
@Controller('fluxo-caixa')
export class FluxoCaixaController {
  constructor(private service: FluxoCaixaService) {}

  @Get()
  @ApiOperation({
    summary: 'Consolidado de caixa realizado (entradas pagas − saídas pagas) por competência.',
  })
  consolidado(@CurrentTenant() tenantId: string, @Query() filtros: FluxoCaixaDto) {
    return this.service.consolidado(tenantId, filtros);
  }
}
