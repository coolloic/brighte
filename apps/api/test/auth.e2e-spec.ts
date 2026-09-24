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

// Pin the expiry so the token lifetime can be asserted exactly.
process.env.JWT_EXPIRES_IN = '15m';

const PREFIX = `e2e-auth-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;

type GqlResponse<T> = { data?: T; errors?: { message: string }[] };
type LoginResult = { login: { accessToken: string; user: { id: string; email: string; role: Role } } };
type TokenPayload = { sub: number; role: Role; iat: number; exp: number };

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let users: typeof User;
  let secret: string;
  const verifier = new JwtService({});

  const gql = async <T>(query: string, variables?: Record<string, unknown>) => {
    const res = await request(app.getHttpServer()).post('/graphql').send({ query, variables });
    return res.body as GqlResponse<T>;
  };

  const login = (loginEmail: string, password: string) =>
    gql<LoginResult>(
      `mutation($email: String!, $password: String!) {
        login(email: $email, password: $password) { accessToken user { id email role } }
      }`,
      { email: loginEmail, password },
    );

  const createUser = (input: Record<string, unknown>) =>
    gql<{ createUser: { id: string; email: string; role: Role } }>(
      `mutation($input: CreateUserInput!) { createUser(input: $input) { id email role } }`,
      { input },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    users = moduleRef.get<typeof User>(getModelToken(User));
    secret = process.env.JWT_SECRET!;

    await users.create({
      email: email('admin'),
      name: 'E2E Admin',
      role: Role.ADMIN,
      passwordHash: await hashPassword('admin-password'),
    });
  });

  afterAll(async () => {
    await users.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  describe('login', () => {
    it('returns a token signed with JWT_SECRET carrying the user id and role', async () => {
      const { data, errors } = await login(email('admin'), 'admin-password');
      expect(errors).toBeUndefined();
      const { accessToken, user } = data!.login;
      expect(user).toMatchObject({ email: email('admin'), role: Role.ADMIN });

      const payload = await verifier.verifyAsync<TokenPayload>(accessToken, {
        secret,
        algorithms: ['HS256'],
      });
      expect(payload.sub).toBe(Number(user.id));
      expect(payload.role).toBe(Role.ADMIN);
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('matches email case-insensitively', async () => {
      const { data, errors } = await login(email('admin').toUpperCase(), 'admin-password');
      expect(errors).toBeUndefined();
      expect(data!.login.user.email).toBe(email('admin'));
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await login(email('admin'), 'not-the-password');
      const unknownEmail = await login(email('nobody'), 'admin-password');
      expect(wrongPassword.errors?.[0].message).toBe('Invalid email or password');
      expect(unknownEmail.errors?.[0].message).toBe('Invalid email or password');
      expect(wrongPassword.data).toBeNull();
    });
  });

  describe('token verification', () => {
    it('rejects a token signed with a different secret', async () => {
      const forged = await verifier.signAsync(
        { sub: 1, role: Role.ADMIN },
        { secret: 'x'.repeat(32), expiresIn: '15m' },
      );
      await expect(verifier.verifyAsync(forged, { secret, algorithms: ['HS256'] })).rejects.toThrow(
        /invalid signature/,
      );
    });

    it('rejects an expired token', async () => {
      const past = Math.floor(Date.now() / 1000) - 60;
      const expired = await verifier.signAsync({ sub: 1, role: Role.ADMIN, iat: past - 60, exp: past }, { secret });
      await expect(verifier.verifyAsync(expired, { secret, algorithms: ['HS256'] })).rejects.toThrow(/jwt expired/);
    });
  });

  describe('createUser', () => {
    it('stores a password hash, lowercases the email, and always creates a USER', async () => {
      const { data, errors } = await createUser({
        email: email('New').toUpperCase(),
        name: 'New User',
        password: 'new-password',
      });
      expect(errors).toBeUndefined();
      expect(data!.createUser).toMatchObject({ email: email('new'), role: Role.USER });

      const stored = await users.scope('withPassword').findOne({ where: { email: email('new') } });
      expect(stored!.passwordHash).toMatch(/^scrypt\$/);
      expect(stored!.passwordHash).not.toContain('new-password');

      const loggedIn = await login(email('new'), 'new-password');
      expect(loggedIn.data!.login.user.role).toBe(Role.USER);
    });

    it('does not accept a role', async () => {
      const { errors } = await createUser({
        email: email('sneaky'),
        name: 'Sneaky',
        password: 'sneaky-password',
        role: 'ADMIN',
      });
      expect(errors?.[0].message).toMatch(/"role" is not defined/);
      expect(await users.count({ where: { email: email('sneaky') } })).toBe(0);
    });

    it('rejects a password shorter than 8 characters', async () => {
      const { errors } = await createUser({ email: email('short'), name: 'Short', password: '1234567' });
      expect(errors?.[0].message).toBe('Password must be at least 8 characters');
      expect(await users.count({ where: { email: email('short') } })).toBe(0);
    });
  });

  it('never exposes passwordHash through GraphQL', async () => {
    const { errors } = await gql(`{ users { passwordHash } }`);
    expect(errors?.[0].message).toMatch(/Cannot query field "passwordHash"/);

    const { data } = await gql<{ users: Record<string, unknown>[] }>(`{ users { id email role } }`);
    expect(data!.users.length).toBeGreaterThan(0);
  });
});
