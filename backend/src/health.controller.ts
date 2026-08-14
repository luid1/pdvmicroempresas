import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/context.decorator';

// Endpoint público de saúde — usado pelo health check do host (Render/Railway).
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'hetros-backend', ts: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ready',
      service: 'hetros-backend',
      database: 'connected',
      ts: new Date().toISOString(),
    };
  }
}
