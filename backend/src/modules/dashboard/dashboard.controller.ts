import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('filialId') filialId?: string,
    @Query('periodo') periodo?: 'hoje' | 'semana' | 'mes' | 'ano' | 'custom',
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.findAll(tenantId, filialId, periodo || 'hoje', dataInicio, dataFim);
  }
}
