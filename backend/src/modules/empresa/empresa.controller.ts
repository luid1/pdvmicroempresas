import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmpresaService } from './empresa.service';
import { DefinirModoDto } from './dto/modo.dto';
import { CurrentTenant, Modulo, AuditEntidade } from '../../common/decorators/context.decorator';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Filiais')
@ApiBearerAuth()
@Modulo('GERENCIAL')
@AuditEntidade('Empresa', 'tenant')
@Controller('empresa')
export class EmpresaController {
  constructor(private service: EmpresaService) {}

  @Get()
  @ApiOperation({ summary: 'Dados da empresa (inclui o modo de operação)' })
  getEmpresa(@CurrentTenant() tenantId: string) {
    return this.service.getEmpresa(tenantId);
  }

  @Put('modo')
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  @ApiOperation({ summary: 'Definir o modo de operação (VAREJO/RESTAURANTE/HIBRIDO)' })
  definirModo(@CurrentTenant() tenantId: string, @Body() dto: DefinirModoDto) {
    return this.service.definirModo(tenantId, dto.modo);
  }
}
