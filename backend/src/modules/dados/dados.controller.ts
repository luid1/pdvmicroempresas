import { Controller, Get, Post, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { DadosService } from './dados.service';
import { CurrentTenant, CurrentUser, Modulo, AuditEntidade } from '../../common/decorators/context.decorator';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

/**
 * Endpoints LGPD (só ADMIN — reforçado no service):
 *  - GET  /dados/exportar             → baixa um JSON com todos os dados do tenant.
 *  - POST /dados/clientes/:id/anonimizar → apaga a PII de um cliente (irreversível).
 */
@ApiTags('Auditoria')
@ApiBearerAuth()
@Modulo('GERENCIAL')
@Controller('dados')
export class DadosController {
  constructor(private service: DadosService) {}

  @Get('exportar')
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  @ApiOperation({ summary: 'LGPD — exportar todos os dados da empresa (JSON)' })
  async exportar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { role?: string },
    @Res() res: Response,
  ) {
    const dados = await this.service.exportarTudo(tenantId, user);
    const nome = `lumin-export-${tenantId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.send(JSON.stringify(dados, null, 2));
  }

  @Post('clientes/:id/anonimizar')
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  @AuditEntidade('Cliente', 'cliente')
  @ApiOperation({ summary: 'LGPD — anonimizar os dados pessoais de um cliente (irreversível)' })
  anonimizarCliente(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { role?: string },
    @Param('id') id: string,
  ) {
    return this.service.anonimizarCliente(tenantId, id, user);
  }
}
