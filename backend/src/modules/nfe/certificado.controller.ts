import { Controller, Get, Post, Delete, Patch, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CertificadoService } from './certificado.service';
import { CurrentTenant, Modulo } from '../../common/decorators/context.decorator';

@ApiTags('Certificados Digitais')
@ApiBearerAuth()
@Modulo('NFE')
@Controller('certificados')
export class CertificadoController {
  constructor(private service: CertificadoService) {}

  @Get()
  @ApiOperation({ summary: 'Lista certificados digitais (sem expor senha/arquivo)' })
  listar(@CurrentTenant() tenantId: string) {
    return this.service.listar(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra certificado A1 (senha é cifrada, nunca em claro)' })
  criar(
    @CurrentTenant() tenantId: string,
    @Body()
    dto: {
      nome: string;
      arquivo: string;
      senha: string;
      filialId?: string;
      cnpj?: string;
      validoDe?: string;
      validoAte?: string;
      tipo?: string;
    },
  ) {
    return this.service.criar(tenantId, dto);
  }

  @Patch(':id/ativar')
  @ApiOperation({ summary: 'Ativa um certificado' })
  ativar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.ativar(tenantId, id);
  }

  @Patch(':id/desativar')
  @ApiOperation({ summary: 'Desativa um certificado' })
  desativar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.desativar(tenantId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um certificado' })
  remover(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remover(tenantId, id);
  }
}
