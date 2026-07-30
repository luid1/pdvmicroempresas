import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { DreService } from './dre.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';

@ApiTags('Dre')
@ApiBearerAuth()
@Controller('dre')
export class DreController {
  constructor(private service: DreService) {}

  @Get()
  @ApiOperation({ summary: 'DRE realizada (linhas). Compat com a rota antiga.' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.findAll(tenantId, { filialId, dataInicio, dataFim });
  }

  @Get('completo')
  @ApiOperation({ summary: 'DRE realizada completa: linhas + KPIs + cobertura/período.' })
  completo(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.gerar(tenantId, { filialId, dataInicio, dataFim });
  }
}
