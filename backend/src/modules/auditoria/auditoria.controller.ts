import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private service: AuditoriaService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }
}
