import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustosService } from './custos.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';
import { SalvarCotacaoDto } from './dto/cotacao.dto';

@ApiTags('Custos & Margem')
@ApiBearerAuth()
@Modulo('FINANCEIRO')
@Controller('custos')
export class CustosController {
  constructor(private service: CustosService) {}

  @Get(':filialId/margem')
  @ApiOperation({ summary: 'CMV, perdas monetizadas, margem média e lucratividade por produto' })
  margem(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('dataIni') dataIni?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getMargem(tenantId, filialId, dataIni, dataFim);
  }

  @Get(':filialId/rentabilidade')
  @ApiOperation({ summary: 'Rentabilidade por cliente (expansível para produtos) — estilo relatório' })
  rentabilidade(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('dataIni') dataIni?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getRentabilidade(tenantId, filialId, dataIni, dataFim);
  }

  @Get(':filialId/composicao')
  @ApiOperation({ summary: 'Todos os produtos com custo base composto (aquisição+frete+chapa) — para a gaveta de cotação' })
  composicao(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('q') q?: string,
  ) {
    return this.service.getComposicao(tenantId, filialId, q);
  }

  @Post(':filialId/cotacao')
  @ApiOperation({ summary: 'Salva as cotações do dia (preço) — ficam disponíveis para o app dos compradores' })
  salvarCotacao(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('filialId') filialId: string,
    @Body() dto: SalvarCotacaoDto,
  ) {
    return this.service.salvarCotacao(tenantId, filialId, user.id, dto.itens);
  }

  @Get(':filialId/cotacoes')
  @ApiOperation({ summary: 'Cotações do dia (só preço final ao cliente) — consumido pelo app dos compradores' })
  cotacoes(
    @CurrentTenant() tenantId: string,
    @Param('filialId') filialId: string,
    @Query('data') data?: string,
  ) {
    return this.service.listarCotacoes(tenantId, filialId, data);
  }
}
