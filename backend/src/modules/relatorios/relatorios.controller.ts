import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RelatoriosService } from './relatorios.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';

@ApiTags('Relatórios')
@ApiBearerAuth()
@Controller('relatorios')
export class RelatoriosController {
  constructor(private service: RelatoriosService) {}

  @Get('curva-abc')
  @ApiOperation({ summary: 'Curva ABC (Pareto) por produto ou cliente no período.' })
  curvaABC(
    @CurrentTenant() tenantId: string,
    @Query('tipo') tipo: 'produto' | 'cliente' = 'produto',
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.curvaABC(tenantId, tipo === 'cliente' ? 'cliente' : 'produto', {
      de,
      ate,
      filialId,
    });
  }

  @Get('giro-estoque')
  @ApiOperation({ summary: 'Giro/cobertura de estoque e itens parados no período.' })
  giro(
    @CurrentTenant() tenantId: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.giroEstoque(tenantId, { de, ate, filialId });
  }

  @Get('ranking')
  @ApiOperation({ summary: 'Ranking de clientes ou produtos no período.' })
  ranking(
    @CurrentTenant() tenantId: string,
    @Query('tipo') tipo: 'cliente' | 'produto' = 'cliente',
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('filialId') filialId?: string,
  ) {
    const t = tipo === 'produto' ? 'produto' : 'cliente';
    return this.service.ranking(tenantId, t, { de, ate, filialId });
  }

  @Get('aging-financeiro')
  @ApiOperation({ summary: 'Posição a receber vs a pagar por faixa de vencimento (aging).' })
  aging(@CurrentTenant() tenantId: string, @Query('filialId') filialId?: string) {
    return this.service.agingFinanceiro(tenantId, filialId);
  }
}
