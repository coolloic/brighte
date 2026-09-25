import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { SkipThrottle } from '@nestjs/throttler';
import { Sequelize } from 'sequelize-typescript';
import { Public } from './auth/index.js';

const logger = new Logger('Health');

/**
 * How long readiness waits for the database. The check goes through the connection pool, so with
 * every connection busy it would otherwise wait for one (up to the pool's acquire timeout).
 */
export const READINESS_TIMEOUT_MS = 2_000;

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

  /**
   * Readiness: the database answers within READINESS_TIMEOUT_MS. 503 otherwise, so traffic goes to
   * other instances until it does.
   */
  @Get('ready')
  async ready() {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`No answer within ${READINESS_TIMEOUT_MS}ms`)), READINESS_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.sequelize.authenticate(), timeout]);
    } catch (error) {
      logger.warn({ msg: 'Readiness check failed: database unreachable or too slow', err: error });
      throw new ServiceUnavailableException('Database unavailable');
    } finally {
      clearTimeout(timer);
    }
    return { status: 'ok' };
  }
}
