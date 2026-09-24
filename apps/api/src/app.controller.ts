import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators.js';

@Controller()
export class AppController {
  @Public() // Liveness probe for load balancers and e2e startup; exposes no data.
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
