import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FiliaisModule } from '../filiais/filiais.module';
import { PlataformaService } from './plataforma.service';
import { PlataformaController } from './plataforma.controller';

/**
 * Painel do DONO DA PLATAFORMA (SaaS). Reaproveita AuthService (criação de tenant)
 * e FiliaisService (CRUD de filiais cross-tenant), ambos exportados por seus módulos.
 */
@Module({
  imports: [AuthModule, FiliaisModule],
  providers: [PlataformaService],
  controllers: [PlataformaController],
})
export class PlataformaModule {}
