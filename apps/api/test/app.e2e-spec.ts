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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('keeps Nest\'s default error response for REST', () => {
    return request(app.getHttpServer())
      .get('/missing')
      .expect(404)
      .expect((res) => expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' }));
  });

  afterEach(async () => {
    await app.close();
  });
});
