import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { hashPassword, Role } from './../src/auth/index.js';
import { User } from './../src/users/index.js';

const PREFIX = `e2e-obs-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;
const PASSWORD = 'observability-password';

type LogCall = [Record<string, unknown>, ...unknown[]];

describe('Observability (e2e)', () => {
  let app: INestApplication<App>;
  let users: typeof User;
  let admin: User;

  const gql = (query: string, variables?: Record<string, unknown>, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send({ query, variables });
  };
  const login = (loginEmail: string, password: string) =>
    gql('mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { accessToken } }', {
      email: loginEmail,
      password,
    });

  /** The structured entries logged (at `level`) while `fn` runs. */
  async function logged(level: 'log' | 'warn', fn: () => Promise<unknown>) {
    const spy = vi.spyOn(Logger.prototype, level).mockImplementation(() => {});
    try {
      await fn();
      return (spy.mock.calls as LogCall[]).map(([entry]) => entry);
    } finally {
      spy.mockRestore();
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    users = moduleRef.get<typeof User>(getModelToken(User));
    admin = await users.create({ email: email('admin'), name: 'Obs Admin', role: Role.ADMIN, passwordHash: await hashPassword(PASSWORD) });
  });

  afterAll(async () => {
    await users.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  describe('health', () => {
    it('reports live without a token', () => request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' }));

    it('reports ready when the database answers', () => request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ok' }));
  });

  describe('database connections', () => {
    const setting = async (name: string) => {
      const [row] = await users.sequelize!.query<Record<string, string>>(`SHOW ${name}`, { type: QueryTypes.SELECT });
      return row[name];
    };

    it('have Postgres cancel slow statements and end abandoned transactions', async () => {
      expect(await setting('statement_timeout')).toBe('5s');
      expect(await setting('idle_in_transaction_session_timeout')).toBe('10s');
    });

    it('name themselves, so they can be told apart in pg_stat_activity', async () => {
      expect(await setting('application_name')).toBe('brighte-api');
    });

    it('cancel a statement that runs past the timeout', async () => {
      await expect(users.sequelize!.query('SELECT pg_sleep(6)')).rejects.toThrow(/statement timeout/);
    }, 10_000);
  });

  describe('request id', () => {
    it('sends back the caller X-Request-Id, so the web server can match its logs', async () => {
      const res = await request(app.getHttpServer()).get('/health/live').set('X-Request-Id', 'web-5d1c9a7e');
      expect(res.headers['x-request-id']).toBe('web-5d1c9a7e');
    });

    it('creates one for GraphQL requests that have none', async () => {
      const res = await gql('{ serviceTypes { code } }');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('security events', () => {
    it('logs a failed login with the account, never the email or password', async () => {
      const entries = await logged('warn', () => login(email('admin'), 'wrong-password'));
      expect(entries).toContainEqual(expect.objectContaining({ event: 'auth.login_failed', reason: 'wrong_password', userId: admin.id }));
      expect(entries).toContainEqual(expect.objectContaining({ operation: 'Login', errors: ['UNAUTHENTICATED'] }));
      expect(JSON.stringify(entries)).not.toMatch(/wrong-password|e2e-obs-/);
    });

    it('logs a login to an unknown email without the email', async () => {
      const entries = await logged('warn', () => login(email('nobody'), PASSWORD));
      expect(entries).toContainEqual(expect.objectContaining({ event: 'auth.login_failed', reason: 'unknown_email' }));
      expect(JSON.stringify(entries)).not.toContain(PREFIX);
    });

    it('logs who created a user (audit)', async () => {
      const token = ((await login(email('admin'), PASSWORD)).body as { data: { login: { accessToken: string } } }).data.login.accessToken;
      const entries = await logged('log', () =>
        gql(
          'mutation($input: CreateUserInput!) { createUser(input: $input) { id } }',
          { input: { email: email('new'), name: 'New User', password: 'new-user-password' } },
          token,
        ),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ event: 'user.created', role: Role.USER, createdBy: admin.id, userId: expect.any(Number) as number }),
      );
      expect(entries).toContainEqual(expect.objectContaining({ msg: 'GraphQL operation', fields: ['createUser'], userId: admin.id, role: Role.ADMIN }));
    });
  });
});
