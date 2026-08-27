import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FiliaisModule } from '../filiais/filiais.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PlataformaService } from './plataforma.service';
import { PlataformaController } from './plataforma.controller';

/**
 * Painel do DONO DA PLATAFORMA (SaaS). Reaproveita AuthService (criação de tenant),
 * FiliaisService (CRUD de filiais cross-tenant) e UsuariosService (CRUD de logins
 * cross-tenant), todos exportados por seus módulos.
 */
@Module({
  imports: [AuthModule, FiliaisModule, UsuariosModule],
  providers: [PlataformaService],
  controllers: [PlataformaController],
})
export class PlataformaModule {}
