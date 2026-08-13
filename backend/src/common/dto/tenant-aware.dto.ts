import { ApiHideProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Base para DTOs de rotas autenticadas.
 *
 * O TenantInterceptor injeta `req.body.tenantId` automaticamente a partir do JWT
 * (e bloqueia manipulação). Como os interceptors rodam ANTES do ValidationPipe,
 * o campo já chega no body — então precisa estar declarado (e permitido) no DTO,
 * caso contrário o `forbidNonWhitelisted` rejeitaria a requisição.
 *
 * É apenas de uso interno: não deve ser preenchido pelo cliente.
 */
export class TenantAwareDto {
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  tenantId?: string;
}
