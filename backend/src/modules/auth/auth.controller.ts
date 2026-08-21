import { Controller, Post, Put, Get, Body, Query, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentTenant, CurrentUser } from '../../common/decorators/context.decorator';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';
import { AuthService } from './auth.service';
import { LoginDto, VincularDto, LoginPorIdDto, LoginPorPinDto, DefinirPinDto, RegisterTenantDto, SalvarPreferenciasDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Get('users')
  @ApiOperation({ summary: 'Lista usuários ativos para tela de seleção (sem senha)' })
  usersForLogin(
    @Headers('x-pair-token') pairToken?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.auth.getUsersForLogin(pairToken, tenantId);
  }

  // Anti-brute-force: no máximo 5 tentativas de login por minuto por IP.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login por e-mail + senha' })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password, body.cnpj);
  }

  // "Libera" o computador para uma loja (CNPJ + senha do administrador).
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('vincular')
  @ApiOperation({ summary: 'Vincula este computador a uma loja (CNPJ + senha do administrador)' })
  vincular(@Body() body: VincularDto) {
    return this.auth.vincularPorCnpj(body.cnpj, body.senha);
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
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  @Post('definir-pin')
  @ApiOperation({ summary: 'Define/troca o PIN de um usuário da própria empresa' })
  definirPin(@CurrentTenant() tenantId: string, @Body() body: DefinirPinDto) {
    return this.auth.definirPin(tenantId, body.usuarioId, body.pin);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('register')
  @ApiOperation({ summary: 'Cadastra novo tenant + admin master' })
  register(@Body() body: RegisterTenantDto) {
    return this.auth.registerTenant(body);
  }

  @ApiBearerAuth()
  @Put('me/preferencias')
  @ApiOperation({ summary: 'Salva preferências de UI do usuário logado (segue a conta)' })
  salvarPreferencias(@CurrentUser() user: { id: string }, @Body() body: SalvarPreferenciasDto) {
    return this.auth.salvarPreferencias(user.id, body.preferencias);
  }
}
