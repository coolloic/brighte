import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001' });
  // Correlate logs with client reports: reuse the caller's request id or assign one.
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-request-id'] ??= randomUUID();
    res.setHeader('x-request-id', req.headers['x-request-id']);
    next();
  });
  await app.listen(process.env.PORT ?? 4001);
}
await bootstrap();
