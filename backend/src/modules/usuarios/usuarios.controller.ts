import { Controller, Get, Post, Put, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CurrentTenant, Modulo, AuditEntidade } from '../../common/decorators/context.decorator';
import { CreateUsuarioDto, UpdateUsuarioDto, ResetSenhaDto, CreateRoleDto, UpdateRoleDto } from './dto/usuario.dto';
import { RequirePermissao } from '../../common/decorators/permissoes.decorator';

@ApiTags('Usuários & Acessos')
@ApiBearerAuth()
@Modulo('GERENCIAL')
@AuditEntidade('Usuario', 'usuario')
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  // ─── Perfis (vem antes de :id pra não conflitar a rota) ───
  @Get('roles')
  @RequirePermissao('GERENCIAL:READ')
  @ApiOperation({ summary: 'Listar perfis (roles) com telas' })
  listRoles(@CurrentTenant() tenantId: string) {
    return this.service.listRoles(tenantId);
  }

  @Post('roles')
  @RequirePermissao('GERENCIAL:CREATE')
  createRole(@CurrentTenant() tenantId: string, @Body() dto: CreateRoleDto) {
    return this.service.createRole(tenantId, dto);
  }

  @Put('roles/:id')
  @RequirePermissao('GERENCIAL:UPDATE')
  updateRole(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.updateRole(tenantId, id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissao('GERENCIAL:DELETE')
  deleteRole(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deleteRole(tenantId, id);
  }

  // ─── Usuários ───
  @Get()
  @RequirePermissao('GERENCIAL:READ')
  @ApiOperation({ summary: 'Listar usuários' })
  list(@CurrentTenant() tenantId: string) {
    return this.service.listUsuarios(tenantId);
  }

  @Post()
  @RequirePermissao('GERENCIAL:CREATE')
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateUsuarioDto) {
    return this.service.createUsuario(tenantId, dto);
  }

  @Put(':id')
  @RequirePermissao('GERENCIAL:UPDATE')
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.service.updateUsuario(tenantId, id, dto);
  }

  @Patch(':id/senha')
  @RequirePermissao('GERENCIAL:CONFIGURAR')
  resetSenha(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: ResetSenhaDto) {
    return this.service.resetSenha(tenantId, id, dto.senha);
  }

  @Delete(':id')
  @RequirePermissao('GERENCIAL:DELETE')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deleteUsuario(tenantId, id);
  }
}
