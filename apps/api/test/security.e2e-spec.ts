import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Op } from 'sequelize';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { Lead } from './../src/leads/index.js';

const PREFIX = `e2e-sec-${Date.now()}`;
const ALLOWED_ORIGIN = 'http://allowed.test';

type GqlError = { message: string; path?: string[]; extensions?: { code?: string; retryAfter?: number } };
type GqlBody = { data?: unknown; errors?: GqlError[] };

/** Run `fn` with an environment variable set, restoring it afterwards. */
async function withEnv<T>(name: string, value: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env[name];
  process.env[name] = value;
  try {
    return await fn();
  } finally {
    process.env[name] = previous;
  }
}

describe('Security (e2e)', () => {
  let app: NestExpressApplication;
  let leads: typeof Lead;

  const post = (body: unknown) => request(app.getHttpServer()).post('/graphql').send(body as object);

  const registerFields = (alias: string) =>
    `${alias}: register(name: "Sec", email: "${PREFIX}-${alias}@test.dev", mobile: "0412345678", postcode: "2000", services: ["delivery"]) { id }`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, { NODE_ENV: 'test', WEB_ORIGIN: ALLOWED_ORIGIN });
    await app.init();
    leads = moduleRef.get<typeof Lead>(getModelToken(Lead));
  });

  afterAll(async () => {
    await leads.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  describe('rate limiting', () => {
    it('counts each aliased register separately, so one request cannot bypass the limit', async () => {
      const res = await withEnv('RATE_LIMIT_REGISTER_PER_MINUTE', '2', () =>
        post({ query: `mutation { ${registerFields('a')} ${registerFields('b')} ${registerFields('c')} }` }),
      );
      const body = res.body as GqlBody;
      expect(body.errors?.[0]).toMatchObject({ path: ['c'], extensions: { code: 'TOO_MANY_REQUESTS' } });
      expect(body.errors![0].extensions!.retryAfter).toBeGreaterThan(0);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(await leads.count({ where: { email: { [Op.like]: `${PREFIX}-%` } } })).toBe(2);
    });

    it('limits login attempts per IP, without affecting other operations', async () => {
      const attempt = () => post({ query: `mutation { login(email: "${PREFIX}-nobody@test.dev", password: "guess-guess") { accessToken } }` });
      const codes = await withEnv('RATE_LIMIT_LOGIN_PER_MINUTE', '2', async () => {
        const results: (string | undefined)[] = [];
        for (let i = 0; i < 3; i++) results.push(((await attempt()).body as GqlBody).errors?.[0].extensions?.code);
        return results;
      });
      expect(codes).toEqual(['UNAUTHENTICATED', 'UNAUTHENTICATED', 'TOO_MANY_REQUESTS']);

      const other = (await post({ query: '{ serviceTypes { code } }' })).body as GqlBody;
      expect(other.errors).toBeUndefined();
    });
  });

  describe('CORS', () => {
    const preflight = (origin: string) =>
      request(app.getHttpServer())
        .options('/graphql')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,authorization');

    it('allows the configured web origin, without credentials', async () => {
      const res = await preflight(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('gives any other origin no CORS headers, so browsers block the response', async () => {
      const res = await preflight('https://evil.test');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('refuses to start in production without WEB_ORIGIN', () => {
      expect(() => configureApp({} as NestExpressApplication, { NODE_ENV: 'production' })).toThrow('WEB_ORIGIN');
    });
  });

  describe('request hardening', () => {
    it('blocks a CSRF-style simple request (text/plain, no preflight)', async () => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify({ query: `mutation { ${registerFields('csrf')} }` }));
      expect(res.status).toBe(400);
      expect(await leads.count({ where: { email: `${PREFIX}-csrf@test.dev` } })).toBe(0);
    });

    it('rejects a query over 1000 tokens before executing it', async () => {
      const res = await post({ query: `{ ${'serviceTypes { code } '.repeat(300)} }` });
      expect(res.status).toBe(400);
      expect((res.body as GqlBody).errors?.[0].extensions?.code).toBe('GRAPHQL_PARSE_FAILED');
    });

    it('rejects batched requests', async () => {
      const res = await post([{ query: '{ serviceTypes { code } }' }, { query: '{ serviceTypes { code } }' }]);
      expect(res.status).toBe(400);
    });

    it('rejects a body over 100kb', async () => {
      const res = await post({ query: '{ serviceTypes { code } }', variables: { pad: 'x'.repeat(110_000) } });
      expect(res.status).toBe(413);
    });

    it('sends security headers and hides the framework', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
