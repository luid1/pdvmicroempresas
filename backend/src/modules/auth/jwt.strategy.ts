import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { getJwtSecret } from '../../common/config/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; tenantId: string; roleId: string }) {
    const user = await this.prisma.usuario.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, ativo: true },
      include: {
        role: { include: { permissoes: { include: { permissao: true } } } },
        filiais: { select: { filialId: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Token inválido ou usuário inativo.');
    return {
      id: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: user.role.nome,
      permissoes: user.role.permissoes.map((p) => `${p.permissao.modulo}:${p.permissao.acao}`),
      // Filiais que o usuário pode operar — usado pelo FilialGuard p/ impedir
      // acesso cruzado entre boxes/filiais da mesma empresa.
      filiais: user.filiais.map((f) => f.filialId),
      email: user.email,
      nome: user.nome,
    };
  }
}
