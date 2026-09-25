import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { SkipThrottle } from '@nestjs/throttler';
import { Sequelize } from 'sequelize-typescript';
import { Public } from './auth/index.js';

const logger = new Logger('Health');

/** Probes for a load balancer or orchestrator. Public, not rate limited, and not in the request log. */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  /** Liveness: the process serves HTTP. Doesn't check the database, so an outage there doesn't get the API restarted. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: the database answers. 503 otherwise, so traffic goes to other instances until it does. */
  @Get('ready')
  async ready() {
    try {
      await this.sequelize.authenticate();
    } catch (error) {
      logger.warn({ msg: 'Readiness check failed: database unreachable', err: error });
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
