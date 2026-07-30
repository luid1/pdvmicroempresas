import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentTenant } from '../../common/decorators/context.decorator';
import { AuthService } from './auth.service';
import { LoginDto, LoginPorIdDto, LoginPorPinDto, DefinirPinDto, RegisterTenantDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Get('users')
  @ApiOperation({ summary: 'Lista usuários ativos para tela de seleção (sem senha)' })
  usersForLogin(
    @Query('tenantId') tenantId?: string,
    @Query('cnpj') cnpj?: string,
  ) {
    return this.auth.getUsersForLogin(tenantId, cnpj);
  }

  // Anti-brute-force: no máximo 5 tentativas de login por minuto por IP.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login por e-mail + senha' })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('login-por-id')
  @ApiOperation({ summary: 'Login visual: seleciona usuário pelo ID e digita a senha' })
  loginPorId(@Body() body: LoginPorIdDto) {
    return this.auth.loginPorId(body.usuarioId, body.password);
  }

  // Anti-brute-force: no máximo 8 tentativas de PIN por minuto por IP.
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Public()
  @Post('login-pin')
  @ApiOperation({ summary: 'Login rápido: seleciona o perfil e digita o PIN de 4 dígitos' })
  loginPorPin(@Body() body: LoginPorPinDto) {
    return this.auth.loginPorPin(body.usuarioId, body.pin);
  }

  @ApiBearerAuth()
  @Post('definir-pin')
  @ApiOperation({ summary: 'Define/troca o PIN de um usuário da própria empresa' })
  definirPin(@CurrentTenant() tenantId: string, @Body() body: DefinirPinDto) {
    return this.auth.definirPin(tenantId, body.usuarioId, body.pin);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastra novo tenant + admin master' })
  register(@Body() body: RegisterTenantDto) {
    return this.auth.registerTenant(body);
  }
}
