import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) is public', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('unknown REST route returns a friendly 404', () => {
    return request(app.getHttpServer())
      .get('/nope')
      .expect(404)
      .expect({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
  });

  afterEach(async () => {
    await app.close();
  });
});
