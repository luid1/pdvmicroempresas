import { Controller, Get, Post, Put, Patch, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FiliaisService } from './filiais.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';
import { CreateFilialDto, UpdateFilialDto, UpdateRegimeFilialDto } from './dto/filial.dto';

@ApiTags('Filiais')
@ApiBearerAuth()
@Controller('filiais')
export class FiliaisController {
  constructor(private service: FiliaisService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra uma nova filial / box' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateFilialDto) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza dados da filial / box' })
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateFilialDto) {
    return this.service.update(tenantId, id, dto);
  }

  @Patch(':id/regime')
  @ApiOperation({ summary: 'Atualiza regime tributário / CNPJ / IE da filial emitente' })
  updateRegime(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRegimeFilialDto) {
    return this.service.updateRegime(tenantId, id, dto);
  }
}
