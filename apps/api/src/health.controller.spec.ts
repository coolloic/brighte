import { ServiceUnavailableException } from '@nestjs/common';
import type { Sequelize } from 'sequelize-typescript';
import { HealthController, READINESS_TIMEOUT_MS } from './health.controller.js';

const controllerWith = (authenticate: () => Promise<void>) => new HealthController({ authenticate } as unknown as Sequelize);

describe('HealthController.ready', () => {
  afterEach(() => vi.useRealTimers());

  it('is ok when the database answers', async () => {
    await expect(controllerWith(async () => {}).ready()).resolves.toEqual({ status: 'ok' });
  });

  it('is unavailable when the database refuses', async () => {
    await expect(controllerWith(() => Promise.reject(new Error('ECONNREFUSED'))).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('gives up after 2 seconds when the database hangs (e.g. every pooled connection is busy)', async () => {
    vi.useFakeTimers();
    const ready = controllerWith(() => new Promise(() => {})).ready();
    const outcome = expect(ready).rejects.toBeInstanceOf(ServiceUnavailableException);
    await vi.advanceTimersByTimeAsync(READINESS_TIMEOUT_MS);
    await outcome;
    expect(READINESS_TIMEOUT_MS).toBe(2_000);
  });
});
