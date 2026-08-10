import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IaService } from './ia.service';
import { CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';

@ApiTags('IA')
@ApiBearerAuth()
@Controller('ia')
export class IaController {
  constructor(private service: IaService) {}

  /**
   * "Oi Lu, como está minha loja hoje?" — resumo do dia da loja logada.
   * Limite mais rígido que o global para conter abuso/custo da IA.
   */
  @Get('resumo-dia')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  resumoDia(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { role?: string; telas?: string[] },
    @Query('filialId') filialId?: string,
  ) {
    return this.service.resumoDoDia(tenantId, user, filialId);
  }

  /**
   * Perguntas fixas (v0.2): tipo = "mais-vendido" | "acabando" | "mais-lucrativo".
   * Escopadas pelo perfil, iguais ao resumo. Mesmo limite rígido por custo.
   */
  @Get('perguntar')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  perguntar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { role?: string; telas?: string[] },
    @Query('tipo') tipo: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.responder(tenantId, user, tipo, filialId);
  }

  /**
   * Chat aberto (v0.3): o usuário pergunta o que quiser sobre a loja. A Lu só lê
   * agregados escopados pelo perfil (nada de SQL/PII). `historico` traz os
   * últimos turnos para dar memória curta à conversa. Mesmo limite rígido por
   * custo da IA.
   */
  @Post('chat')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  chat(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { role?: string; telas?: string[] },
    @Body() body: { pergunta?: string; historico?: { autor: 'user' | 'lu'; texto: string }[]; filialId?: string },
  ) {
    return this.service.conversar(tenantId, user, body?.pergunta || '', body?.historico, body?.filialId);
  }

  /**
   * Barra de comando (v0.4): interpreta uma frase livre e devolve uma AÇÃO
   * (rascunho de lançamento a confirmar), um ESCLARECIMENTO ou uma RESPOSTA.
   * Continua só-leitura — a gravação de qualquer lançamento passa depois pelo
   * endpoint oficial de tesouraria, com seu próprio guard.
   */
  @Post('comando')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  comando(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { role?: string; telas?: string[] },
    @Body() body: { texto?: string; historico?: { autor: 'user' | 'lu'; texto: string }[]; filialId?: string },
  ) {
    return this.service.comando(tenantId, user, body?.texto || '', body?.historico, body?.filialId);
  }
}
