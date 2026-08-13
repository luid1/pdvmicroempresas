import { Controller, Get, Post, Put, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CurrentTenant, Modulo, AuditEntidade } from '../../common/decorators/context.decorator';
import { CreateUsuarioDto, UpdateUsuarioDto, ResetSenhaDto, CreateRoleDto, UpdateRoleDto } from './dto/usuario.dto';

@ApiTags('Usuários & Acessos')
@ApiBearerAuth()
@Modulo('CADASTROS')
@AuditEntidade('Usuario', 'usuario')
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  // ─── Perfis (vem antes de :id pra não conflitar a rota) ───
  @Get('roles')
  @ApiOperation({ summary: 'Listar perfis (roles) com telas' })
  listRoles(@CurrentTenant() tenantId: string) {
    return this.service.listRoles(tenantId);
  }

  @Post('roles')
  createRole(@CurrentTenant() tenantId: string, @Body() dto: CreateRoleDto) {
    return this.service.createRole(tenantId, dto);
  }

  @Put('roles/:id')
  updateRole(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.updateRole(tenantId, id, dto);
  }

  @Delete('roles/:id')
  deleteRole(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deleteRole(tenantId, id);
  }

  // ─── Usuários ───
  @Get()
  @ApiOperation({ summary: 'Listar usuários' })
  list(@CurrentTenant() tenantId: string) {
    return this.service.listUsuarios(tenantId);
  }

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateUsuarioDto) {
    return this.service.createUsuario(tenantId, dto);
  }

  @Put(':id')
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.service.updateUsuario(tenantId, id, dto);
  }

  @Patch(':id/senha')
  resetSenha(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: ResetSenhaDto) {
    return this.service.resetSenha(tenantId, id, dto.senha);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deleteUsuario(tenantId, id);
  }
}
