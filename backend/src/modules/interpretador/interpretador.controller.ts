import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { InterpretadorService } from './interpretador.service';
import { CurrentTenant, Modulo } from '../../common/decorators/context.decorator';

@ApiTags('Pedidos — Captação por Voz/Texto (IA)')
@ApiBearerAuth()
@Modulo('ESTOQUE')
@Controller('pedidos')
export class InterpretadorController {
  constructor(private service: InterpretadorService) {}

  // IA custa por chamada: no máximo 20 interpretações por minuto por IP.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('interpretar-whatsapp')
  @ApiOperation({
    summary: 'Interpreta um texto bruto de pedido (WhatsApp) e devolve os itens casados com o cadastro de produtos',
  })
  interpretar(@CurrentTenant() tenantId: string, @Body('texto_bruto') textoBruto: string) {
    return this.service.interpretarWhatsapp(tenantId, textoBruto);
  }
}
