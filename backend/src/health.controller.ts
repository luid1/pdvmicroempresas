import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/context.decorator';

// Endpoint público de saúde — usado pelo health check do host (Render/Railway).
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'hetros-backend', ts: new Date().toISOString() };
  }
}
