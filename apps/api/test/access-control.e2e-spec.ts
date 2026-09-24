import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { hashPassword } from './../src/auth/password.js';
import { Role } from './../src/auth/role.enum.js';
import { User } from './../src/users/user.model.js';

const PREFIX = `e2e-acl-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;

type GqlResponse<T> = { data?: T | null; errors?: { message: string; extensions?: { code?: string } }[] };

describe('Access control (e2e)', () => {
  let app: INestApplication<App>;
  let users: typeof User;
  let adminToken: string;
  let userToken: string;
  let userId: number;

  const gql = async <T>(query: string, token?: string, variables?: Record<string, unknown>) => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) req.set('Authorization', token.includes(' ') ? token : `Bearer ${token}`);
    const res = await req.send({ query, variables });
    return res.body as GqlResponse<T>;
  };

  const code = (res: GqlResponse<unknown>) => res.errors?.[0].extensions?.code;

  const login = async (loginEmail: string, password: string) => {
    const res = await gql<{ login: { accessToken: string } }>(
      `mutation($e: String!, $p: String!) { login(email: $e, password: $p) { accessToken } }`,
      undefined,
      { e: loginEmail, p: password },
    );
    return res.data!.login.accessToken;
  };

  const createUser = (token: string | undefined, name: string, role?: Role) =>
    gql<{ createUser: { email: string; role: Role } }>(
      `mutation($input: CreateUserInput!) { createUser(input: $input) { email role } }`,
      token,
      { input: { email: email(name), name, password: `${name}-password`, ...(role && { role }) } },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    users = moduleRef.get<typeof User>(getModelToken(User));

    await users.create({ email: email('admin'), name: 'ACL Admin', role: Role.ADMIN, passwordHash: await hashPassword('admin-password') });
    const user = await users.create({ email: email('user'), name: 'ACL User', role: Role.USER, passwordHash: await hashPassword('user-password') });
    userId = user.id;
    adminToken = await login(email('admin'), 'admin-password');
    userToken = await login(email('user'), 'user-password');
  });

  afterAll(async () => {
    await users.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  describe('public', () => {
    it('GET / needs no token', () => request(app.getHttpServer()).get('/').expect(200).expect('Hello World!'));

    it('login needs no token', () => {
      expect(adminToken).toBeTruthy();
    });
  });

  describe('authentication', () => {
    it('rejects a request with no token', async () => {
      expect(code(await gql(`{ me { id } }`))).toBe('UNAUTHENTICATED');
    });

    it('rejects a non-Bearer Authorization header', async () => {
      expect(code(await gql(`{ me { id } }`, `Basic ${userToken}`))).toBe('UNAUTHENTICATED');
    });

    it('rejects a token signed with another secret', async () => {
      const forged = await new JwtService({}).signAsync({ sub: userId, role: Role.ADMIN }, { secret: 'x'.repeat(32) });
      expect(code(await gql(`{ users { id } }`, forged))).toBe('UNAUTHENTICATED');
    });

    it('rejects an expired token', async () => {
      const past = Math.floor(Date.now() / 1000) - 60;
      const expired = await new JwtService({}).signAsync(
        { sub: userId, role: Role.USER, iat: past - 60, exp: past },
        { secret: process.env.JWT_SECRET! },
      );
      expect(code(await gql(`{ me { id } }`, expired))).toBe('UNAUTHENTICATED');
    });

    it('rejects a valid token whose user no longer exists', async () => {
      const ghost = await users.create({ email: email('ghost'), name: 'Ghost', passwordHash: await hashPassword('ghost-password') });
      const token = await login(email('ghost'), 'ghost-password');
      await ghost.destroy();
      expect(code(await gql(`{ me { id } }`, token))).toBe('UNAUTHENTICATED');
    });
  });

  describe('USER', () => {
    it('can read itself via me', async () => {
      const res = await gql<{ me: { id: string; email: string; role: Role } }>(`{ me { id email role } }`, userToken);
      expect(res.errors).toBeUndefined();
      expect(res.data!.me).toEqual({ id: String(userId), email: email('user'), role: Role.USER });
    });

    it('cannot list users', async () => {
      const res = await gql(`{ users { id } }`, userToken);
      expect(code(res)).toBe('FORBIDDEN');
      expect(res.data).toBeNull();
    });

    it('cannot create users', async () => {
      expect(code(await createUser(userToken, 'by-user'))).toBe('FORBIDDEN');
      expect(await users.count({ where: { email: email('by-user') } })).toBe(0);
    });
  });

  describe('ADMIN', () => {
    it('can read itself via me', async () => {
      const res = await gql<{ me: { role: Role } }>(`{ me { role } }`, adminToken);
      expect(res.data!.me.role).toBe(Role.ADMIN);
    });

    it('can list users', async () => {
      const res = await gql<{ users: { email: string }[] }>(`{ users { email } }`, adminToken);
      expect(res.errors).toBeUndefined();
      expect(res.data!.users.map((u) => u.email)).toEqual(expect.arrayContaining([email('admin'), email('user')]));
    });

    it('can create a USER by default and an ADMIN when asked', async () => {
      expect((await createUser(adminToken, 'plain')).data!.createUser.role).toBe(Role.USER);
      expect((await createUser(adminToken, 'boss', Role.ADMIN)).data!.createUser.role).toBe(Role.ADMIN);
    });
  });

  it('anonymous callers cannot create users', async () => {
    expect(code(await createUser(undefined, 'anon'))).toBe('UNAUTHENTICATED');
    expect(await users.count({ where: { email: email('anon') } })).toBe(0);
  });
});
