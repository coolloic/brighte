import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // Startup logs are held until the pino logger is ready, so every line is JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  // PORT (set by hosting platforms and the smoke test) wins over API_PORT from the root .env.
  await app.listen(process.env.PORT ?? process.env.API_PORT ?? 4001);
}
await bootstrap();
