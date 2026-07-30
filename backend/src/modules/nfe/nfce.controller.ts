import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NfceService } from './nfce.service';
import { CurrentTenant, CurrentUser, Modulo } from '../../common/decorators/context.decorator';

@ApiTags('NFC-e')
@ApiBearerAuth()
@Modulo('NFE')
@Controller('nfce')
export class NfceController {
  constructor(private service: NfceService) {}

  @Get('status')
  @ApiOperation({ summary: 'Retorna se a emissão de NFC-e está habilitada e em qual modo' })
  status() {
    const modo = (process.env.NFCE_MODO || 'desligado').toLowerCase();
    return { habilitado: this.service.habilitado(), modo };
  }

  @Get('documento/:id')
  @ApiOperation({ summary: 'Detalhe de uma NFC-e (modelo 65) com itens' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post('emitir-de-pedido/:pedidoId')
  @ApiOperation({ summary: 'Emite NFC-e (modelo 65) a partir de uma venda/pedido do PDV' })
  emitirDePedido(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('pedidoId') pedidoId: string,
    @Body('filialId') filialId: string,
  ) {
    return this.service.emitirDePedido(tenantId, pedidoId, filialId, user.id);
  }
}
