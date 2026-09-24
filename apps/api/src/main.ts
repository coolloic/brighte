import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // PORT (set by hosting platforms and the smoke test) wins over API_PORT from the root .env.
  await app.listen(process.env.PORT ?? process.env.API_PORT ?? 4001);
}
await bootstrap();
