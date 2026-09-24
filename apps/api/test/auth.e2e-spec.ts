import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/auth/role.enum.js';
import { User } from '../src/users/user.model.js';

type AuthPayload = { accessToken: string; user: { id: string; email: string; role: string } };
type GqlBody = {
  data?: { register?: AuthPayload; login?: AuthPayload; me?: unknown; users?: unknown } | null;
  errors?: { message: string; extensions: { code: string; details?: Record<string, string[]>; http?: unknown } }[];
};

describe('Auth, authorization, validation and errors (e2e)', () => {
  let app: INestApplication<App>;
  const password = 'correct horse battery';

  const gql = (query: string, variables?: object, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql').send({ query, variables });
    return token ? req.set('authorization', `Bearer ${token}`) : req;
  };
  const register = (email: string, pw = password) =>
    gql(
      'mutation($i: RegisterInput!) { register(input: $i) { accessToken user { id email role } } }',
      { i: { email, name: 'Test User', password: pw } },
    );
  const newEmail = () => `user-${randomUUID()}@example.com`;
  const body = (res: request.Response) => res.body as GqlBody;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('register returns a token, a USER role and a normalised email', async () => {
      const email = newEmail();
      const res = await register(`  ${email.toUpperCase()} `).expect(200);
      expect(body(res).data?.register?.user).toMatchObject({ email, role: 'USER' });
      expect(body(res).data?.register?.accessToken).toEqual(expect.any(String));
    });

    it('login succeeds with the right password', async () => {
      const email = newEmail();
      await register(email);
      const res = await gql('mutation($i: LoginInput!) { login(input: $i) { accessToken } }', {
        i: { email, password },
      }).expect(200);
      expect(body(res).data?.login?.accessToken).toEqual(expect.any(String));
    });

    it.each([
      ['wrong password', true],
      ['unknown email', false],
    ])('login with %s → 401 INVALID_CREDENTIALS (same message)', async (_, exists) => {
      const email = newEmail();
      if (exists) await register(email);
      const res = await gql('mutation($i: LoginInput!) { login(input: $i) { accessToken } }', {
        i: { email, password: 'not the password' },
      }).expect(401);
      expect(body(res).errors?.[0]).toMatchObject({
        message: 'Email or password is incorrect.',
        extensions: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('protected query without a token → 401 UNAUTHENTICATED', async () => {
      const res = await gql('{ me { id } }').expect(401);
      expect(body(res).errors?.[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    it('protected query with an invalid token → 401 UNAUTHENTICATED', async () => {
      const res = await gql('{ me { id } }', undefined, 'not-a-jwt').expect(401);
      expect(body(res).errors?.[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    it('me returns the caller', async () => {
      const email = newEmail();
      const token = body(await register(email)).data?.register?.accessToken;
      const res = await gql('{ me { email role } }', undefined, token).expect(200);
      expect(body(res).data?.me).toEqual({ email, role: 'USER' });
    });
  });

  describe('authorization (least privilege)', () => {
    it('USER cannot list users → 403 FORBIDDEN', async () => {
      const token = body(await register(newEmail())).data?.register?.accessToken;
      const res = await gql('{ users { id } }', undefined, token).expect(403);
      expect(body(res).errors?.[0]).toMatchObject({
        message: 'You do not have permission to perform this action.',
        extensions: { code: 'FORBIDDEN' },
      });
    });

    it('ADMIN can list users', async () => {
      const email = newEmail();
      await register(email);
      await app.get<typeof User>(getModelToken(User)).update({ role: Role.ADMIN }, { where: { email } });
      const login = await gql('mutation($i: LoginInput!) { login(input: $i) { accessToken } }', {
        i: { email, password },
      });
      const res = await gql('{ users { email } }', undefined, body(login).data?.login?.accessToken).expect(200);
      expect(body(res).data?.users).toEqual(expect.arrayContaining([{ email }]));
    });

    it('passwordHash is not part of the schema', async () => {
      const token = body(await register(newEmail())).data?.register?.accessToken;
      const res = await gql('{ me { passwordHash } }', undefined, token).expect(400);
      expect(body(res).errors?.[0].extensions.code).toBe('BAD_REQUEST');
    });
  });

  describe('input validation and errors', () => {
    it('invalid input → 400 VALIDATION_FAILED with field details', async () => {
      const res = await gql('mutation($i: RegisterInput!) { register(input: $i) { accessToken } }', {
        i: { email: 'nope', name: '', password: 'short' },
      }).expect(400);
      const err = body(res).errors?.[0];
      expect(err?.extensions.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(err?.extensions.details ?? {}).sort()).toEqual(['email', 'name', 'password']);
    });

    it('duplicate email → 409 EMAIL_TAKEN', async () => {
      const email = newEmail();
      await register(email);
      const res = await register(email).expect(409);
      expect(body(res).errors?.[0].extensions.code).toBe('EMAIL_TAKEN');
    });

    it('malformed query → 400 BAD_REQUEST', async () => {
      const res = await gql('{ me {').expect(400);
      expect(body(res).errors?.[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('never leaks internals (no stacktrace, no http extension)', async () => {
      const res = await gql('{ me { id } }').expect(401);
      const ext = body(res).errors?.[0].extensions ?? {};
      expect(Object.keys(ext)).toEqual(['code']);
    });
  });
});
