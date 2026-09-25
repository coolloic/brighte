import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { hashPassword, Role } from './../src/auth/index.js';
import { User } from './../src/users/index.js';

// Pin the expiry so the token lifetime can be asserted exactly.
process.env.JWT_EXPIRES_IN = '15m';

const PREFIX = `e2e-auth-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;

type GqlResponse<T> = { data?: T; errors?: { message: string; extensions?: { code?: string; fields?: Record<string, string> } }[] };
type LoginResult = { login: { accessToken: string; user: { id: string; email: string; role: Role } } };
type TokenPayload = { sub: number; role: Role; auth_time: number; iat: number; exp: number };
type RenewResult = { renewToken: { accessToken: string; user: { id: string; role: Role } } };

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let users: typeof User;
  let secret: string;
  const verifier = new JwtService({});

  let adminToken: string;

  const gql = async <T>(query: string, variables?: Record<string, unknown>, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req.send({ query, variables });
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
      adminToken,
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
    adminToken = (await login(email('admin'), 'admin-password')).data!.login.accessToken;
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
      // Signed in just now: the session's start, kept by renewals.
      expect(Math.abs(payload.auth_time - Date.now() / 1000)).toBeLessThan(5);
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

  describe('renewToken', () => {
    const renew = (token?: string) => gql<RenewResult>(`mutation { renewToken { accessToken user { id role } } }`, undefined, token);
    const decode = (token: string) => verifier.verifyAsync<TokenPayload>(token, { secret, algorithms: ['HS256'] });
    const now = () => Math.floor(Date.now() / 1000);
    const adminId = async () => (await users.findOne({ where: { email: email('admin') } }))!.id;
    /** A token as if signed in `ago` seconds ago, still valid for `left` seconds. */
    const tokenSignedIn = async (ago: number, { left = 600, sub, role = Role.ADMIN }: { left?: number; sub?: number; role?: Role } = {}) =>
      verifier.signAsync({ sub: sub ?? (await adminId()), role, auth_time: now() - ago, iat: now(), exp: now() + left }, { secret });

    it('gives a fresh token that keeps the sign-in time', async () => {
      const token = await tokenSignedIn(3600);
      const { data, errors } = await renew(token);
      expect(errors).toBeUndefined();
      const [before, after] = await Promise.all([decode(token), decode(data!.renewToken.accessToken)]);
      expect(after).toMatchObject({ sub: before.sub, role: Role.ADMIN, auth_time: before.auth_time });
      expect(after.exp - after.iat).toBe(15 * 60);
      expect(data!.renewToken.user.role).toBe(Role.ADMIN);
    });

    it('needs a valid token', async () => {
      expect((await renew()).errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
      const expired = await verifier.signAsync({ sub: await adminId(), role: Role.ADMIN, auth_time: now() - 120, iat: now() - 120, exp: now() - 60 }, { secret });
      expect((await renew(expired)).errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('stops 8 hours after signing in, and never issues a token past that', async () => {
      const tooOld = await renew(await tokenSignedIn(8 * 3600 + 1));
      expect(tooOld.errors?.[0]).toMatchObject({ message: 'Session expired, sign in again', extensions: { code: 'UNAUTHENTICATED' } });

      // Two minutes left of the 8 hours: the new token ends with the session, not 15 minutes later.
      const nearTheEnd = await tokenSignedIn(8 * 3600 - 120);
      const { accessToken } = (await renew(nearTheEnd)).data!.renewToken;
      const payload = await decode(accessToken);
      expect(payload.exp).toBeLessThanOrEqual(payload.auth_time + 8 * 3600);
    });

    it('refuses tokens from before sessions had a limit (no auth_time)', async () => {
      const legacy = await verifier.signAsync({ sub: await adminId(), role: Role.ADMIN }, { secret, expiresIn: '10m' });
      expect((await renew(legacy)).errors?.[0].message).toBe('Session expired, sign in again');
    });

    it('reads the account again: a new role applies, a deleted account is refused', async () => {
      const user = await users.create({ email: email('renew'), name: 'Renew', role: Role.USER, passwordHash: await hashPassword('renew-password') });
      const token = await tokenSignedIn(60, { sub: user.id, role: Role.USER });
      await user.update({ role: Role.ADMIN });
      const promoted = await decode((await renew(token)).data!.renewToken.accessToken);
      expect(promoted.role).toBe(Role.ADMIN);

      await user.destroy();
      expect((await renew(token)).errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('createUser', () => {
    it('stores a password hash, lowercases the email, and defaults to USER', async () => {
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

    it('lets an admin create another admin, who can then log in', async () => {
      const { data, errors } = await createUser({
        email: email('admin2'),
        name: 'Second Admin',
        password: 'admin2-password',
        role: 'ADMIN',
      });
      expect(errors).toBeUndefined();
      expect(data!.createUser.role).toBe(Role.ADMIN);

      const loggedIn = await login(email('admin2'), 'admin2-password');
      expect(loggedIn.data!.login.user.role).toBe(Role.ADMIN);
    });

    it('rejects a password shorter than 8 characters', async () => {
      const { errors } = await createUser({ email: email('short'), name: 'Short', password: '1234567' });
      expect(errors?.[0].extensions?.code).toBe('BAD_USER_INPUT');
      expect(errors?.[0].extensions?.fields).toEqual({ password: 'Password must be at least 8 characters' });
      expect(await users.count({ where: { email: email('short') } })).toBe(0);
    });

    it('trims the email, so the new user can log in with it', async () => {
      const { errors } = await createUser({ email: ` ${email('Spaced')} `, name: ' Spaced ', password: 'spaced-password' });
      expect(errors).toBeUndefined();
      const loggedIn = await login(email('spaced'), 'spaced-password');
      expect(loggedIn.data!.login.user.email).toBe(email('spaced'));
    });

    it('rejects an email that is already registered, whatever its case', async () => {
      const { errors } = await createUser({ email: email('admin').toUpperCase(), name: 'Dup', password: 'dup-password' });
      expect(errors?.[0].message).toBe('Email is already registered');
      expect(errors?.[0].extensions?.code).toBe('CONFLICT');
    });
  });

  it('masks unexpected errors', async () => {
    const findAll = vi.spyOn(users, 'findAll').mockRejectedValueOnce(new Error('connection to db-host:5432 refused'));
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const { errors } = await gql(`{ users { id } }`, undefined, adminToken);
    expect(errors).toHaveLength(1);
    expect(errors![0]).toMatchObject({ message: 'Internal server error', path: ['users'] });
    // Exact match: no stacktrace or other internals leak through extensions.
    expect(errors![0].extensions).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
    expect(log).toHaveBeenCalledWith('connection to db-host:5432 refused', expect.stringContaining('Error: connection'));
    findAll.mockRestore();
    log.mockRestore();
  });

  it('never exposes passwordHash through GraphQL', async () => {
    const { errors } = await gql(`{ users { passwordHash } }`, undefined, adminToken);
    expect(errors?.[0].message).toMatch(/Cannot query field "passwordHash"/);

    const { data } = await gql<{ users: Record<string, unknown>[] }>(`{ users { id email role } }`, undefined, adminToken);
    expect(data!.users.length).toBeGreaterThan(0);
  });
});
