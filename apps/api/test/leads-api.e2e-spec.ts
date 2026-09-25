import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { hashPassword, Role } from './../src/auth/index.js';
import { Lead, ServiceType } from './../src/leads/index.js';
import { User } from './../src/users/index.js';

const PREFIX = `e2e-lapi-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@test.dev`;
// A service type only this file uses, so list assertions are not affected by other tests' leads.
const TEST_TYPE = `${PREFIX}-type`;

type GqlError = { message: string; extensions?: { code?: string; fields?: Record<string, string> } };
type GqlResponse<T> = { data?: T | null; errors?: GqlError[] };
type LeadResult = { id: string; name: string; email: string; mobile: string; postcode: string; services: { code: string }[] };
type PageResult = { leads: { total: number; limit: number; offset: number; items: LeadResult[] } };

const LEAD_FIELDS = 'id name email mobile postcode services { code }';
const REGISTER = `mutation($name: String!, $email: String!, $mobile: String!, $postcode: String!, $services: [String!]!) {
  register(name: $name, email: $email, mobile: $mobile, postcode: $postcode, services: $services) { ${LEAD_FIELDS} }
}`;
const LEADS = `query($limit: Int, $offset: Int, $serviceType: String, $sort: LeadSort) {
  leads(limit: $limit, offset: $offset, serviceType: $serviceType, sort: $sort) { total limit offset items { ${LEAD_FIELDS} } }
}`;

describe('Leads API (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let users: typeof User;
  let leads: typeof Lead;
  let serviceTypes: typeof ServiceType;
  let adminToken: string;
  let userToken: string;

  const gql = async <T>(query: string, variables?: Record<string, unknown>, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return (await req.send({ query, variables })).body as GqlResponse<T>;
  };

  const register = (name: string, overrides: Record<string, unknown> = {}) =>
    gql<{ register: LeadResult }>(REGISTER, {
      name: `Lead ${name}`,
      email: email(name),
      mobile: '0412 345 678',
      postcode: '2000',
      services: [TEST_TYPE, 'delivery'],
      ...overrides,
    });

  const listLeads = (variables: Record<string, unknown>, token = adminToken) => gql<PageResult>(LEADS, variables, token);

  const login = async (loginEmail: string, password: string) => {
    const res = await gql<{ login: { accessToken: string } }>(
      `mutation($e: String!, $p: String!) { login(email: $e, password: $p) { accessToken } }`,
      { e: loginEmail, p: password },
    );
    return res.data!.login.accessToken;
  };

  const error = (res: GqlResponse<unknown>) => res.errors?.[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    sequelize = moduleRef.get<Sequelize>(getConnectionToken());
    users = moduleRef.get<typeof User>(getModelToken(User));
    leads = moduleRef.get<typeof Lead>(getModelToken(Lead));
    serviceTypes = moduleRef.get<typeof ServiceType>(getModelToken(ServiceType));

    await serviceTypes.create({ code: TEST_TYPE, label: 'Test type' });
    await users.create({ email: email('admin'), name: 'Admin', role: Role.ADMIN, passwordHash: await hashPassword('admin-password') });
    await users.create({ email: email('user'), name: 'User', role: Role.USER, passwordHash: await hashPassword('user-password') });
    adminToken = await login(email('admin'), 'admin-password');
    userToken = await login(email('user'), 'user-password');
  });

  afterAll(async () => {
    await leads.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await serviceTypes.destroy({ where: { code: { [Op.like]: `${PREFIX}-%` } } });
    await users.destroy({ where: { email: { [Op.like]: `${PREFIX}-%` } } });
    await app.close();
  });

  describe('serviceTypes', () => {
    it('lists active types without a token', async () => {
      await serviceTypes.create({ code: `${PREFIX}-retired`, label: 'Retired', active: false });
      const res = await gql<{ serviceTypes: { code: string }[] }>(`{ serviceTypes { code label active } }`);
      const codes = res.data!.serviceTypes.map((t) => t.code);
      expect(codes).toEqual(expect.arrayContaining(['delivery', 'pick-up', 'payment', TEST_TYPE]));
      expect(codes).not.toContain(`${PREFIX}-retired`);
    });
  });

  describe('register', () => {
    it('returns the new lead, normalised, with its services, without a token', async () => {
      const res = await register('happy', { email: email('Happy').toUpperCase(), mobile: '+61 412 345 678', services: ['delivery', 'payment', 'delivery'] });
      expect(res.errors).toBeUndefined();
      expect(res.data!.register).toMatchObject({ name: 'Lead happy', email: email('happy'), mobile: '0412345678', postcode: '2000' });
      expect(res.data!.register.id).toMatch(/^[0-9a-f-]{8}-[0-9a-f]{4}-7/);
      expect(res.data!.register.services.map((s) => s.code)).toEqual(['delivery', 'payment']);
    });

    it('rejects an email that is already registered and changes nothing', async () => {
      await register('twice', { services: ['delivery'] });
      const res = await register('twice-again', { email: email('TWICE'), services: ['payment'] });
      expect(error(res)).toMatchObject({ message: 'Email is already registered', extensions: { code: 'CONFLICT' } });

      const stored = await leads.findAll({ where: { email: email('twice') }, include: [ServiceType] });
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Lead twice');
      expect(stored[0].services!.map((s) => s.code)).toEqual(['delivery']);
    });

    it('reports every invalid field and stores nothing', async () => {
      const res = await register('invalid', { email: 'nope', mobile: '123', postcode: '20', services: [] });
      expect(error(res)?.extensions?.code).toBe('BAD_USER_INPUT');
      expect(Object.keys(error(res)!.extensions!.fields!).sort()).toEqual(['email', 'mobile', 'postcode', 'services']);
      expect(await leads.count({ where: { email: 'nope' } })).toBe(0);
    });

    it('rejects an unknown service code and stores nothing', async () => {
      const res = await register('unknown', { services: ['delivery', 'teleport'] });
      expect(error(res)?.extensions).toEqual({
        code: 'BAD_USER_INPUT',
        fields: { services: 'Unknown or unavailable service: teleport' },
      });
      expect(await leads.count({ where: { email: email('unknown') } })).toBe(0);
    });

    it('accepts a service type added as data, with no code change, and refuses it once retired', async () => {
      const added = await serviceTypes.create({ code: `${PREFIX}-catering`, label: 'Catering' });
      const res = await register('catering', { services: [`${PREFIX}-catering`] });
      expect(res.data!.register.services.map((s) => s.code)).toEqual([`${PREFIX}-catering`]);

      await added.update({ active: false });
      expect(error(await register('catering-late', { services: [`${PREFIX}-catering`] }))?.extensions?.fields).toHaveProperty('services');
    });
  });

  describe('leads', () => {
    let ordered: string[]; // ids of this file's TEST_TYPE leads, oldest first

    beforeAll(async () => {
      ordered = [];
      for (const name of ['p-carol', 'p-alice', 'p-bob']) {
        ordered.push((await register(name, { services: [TEST_TYPE, 'pick-up'] })).data!.register.id);
      }
    });

    it('needs an ADMIN token', async () => {
      expect(error(await listLeads({}, ''))?.extensions?.code).toBe('UNAUTHENTICATED');
      expect(error(await listLeads({}, userToken))?.extensions?.code).toBe('FORBIDDEN');
    });

    it('filters by service type and pages newest first by default', async () => {
      const first = await listLeads({ serviceType: TEST_TYPE, limit: 2 });
      expect(first.errors).toBeUndefined();
      const page1 = first.data!.leads;
      // Registered by the register tests above, plus the three from this block.
      expect(page1).toMatchObject({ limit: 2, offset: 0 });
      expect(page1.items.map((l) => l.id)).toEqual([ordered[2], ordered[1]]);

      const page2 = (await listLeads({ serviceType: TEST_TYPE, limit: 2, offset: 2 })).data!.leads;
      expect(page2.items[0].id).toBe(ordered[0]);
      expect(page2.total).toBe(page1.total);
    });

    it('treats a null, blank or omitted serviceType as no filter', async () => {
      const totals = await Promise.all([{}, { serviceType: null }, { serviceType: '' }].map(async (args) => (await listLeads({ ...args, limit: 1 })).data!.leads.total));
      expect(new Set(totals).size).toBe(1);
      // Unfiltered: at least as many as any filter.
      expect(totals[0]).toBeGreaterThanOrEqual((await listLeads({ serviceType: TEST_TYPE, limit: 1 })).data!.leads.total);
    });

    it('returns every service of a filtered lead, not only the one filtered on', async () => {
      const page = (await listLeads({ serviceType: 'pick-up', limit: 100 })).data!.leads;
      const lead = page.items.find((l) => l.id === ordered[0])!;
      expect(lead.services.map((s) => s.code).sort()).toEqual(['pick-up', TEST_TYPE].sort());
    });

    it('sorts oldest first and by name', async () => {
      const oldest = (await listLeads({ serviceType: TEST_TYPE, sort: 'OLDEST_FIRST', limit: 100 })).data!.leads.items.map((l) => l.id);
      expect(oldest.filter((id) => ordered.includes(id))).toEqual(ordered);

      const byName = (await listLeads({ serviceType: TEST_TYPE, sort: 'NAME_ASC', limit: 100 })).data!.leads.items.map((l) => l.name);
      expect(byName).toEqual([...byName].sort());
    });

    it('returns an empty page for an unknown service type', async () => {
      expect((await listLeads({ serviceType: 'teleport' })).data!.leads).toEqual({ total: 0, limit: 20, offset: 0, items: [] });
    });

    it('rejects a limit above 100', async () => {
      expect(error(await listLeads({ limit: 101 }))?.extensions?.fields).toHaveProperty('limit');
    });

    it('loads services for a whole page in one query (no N+1)', async () => {
      const query = vi.spyOn(sequelize, 'query');
      const res = await listLeads({ serviceType: TEST_TYPE, limit: 100 });
      const queries = query.mock.calls.length;
      query.mockRestore();

      expect(res.data!.leads.items.length).toBeGreaterThanOrEqual(3);
      // Type lookup, count, page, services batch: constant, however many leads are on the page.
      expect(queries).toBeLessThanOrEqual(4);
    });
  });

  describe('lead', () => {
    const LEAD = `query($id: ID!) { lead(id: $id) { ${LEAD_FIELDS} } }`;

    it('returns a lead with its services', async () => {
      const created = (await register('single', { services: ['payment'] })).data!.register;
      const res = await gql<{ lead: LeadResult }>(LEAD, { id: created.id }, adminToken);
      expect(res.data!.lead).toEqual(created);
    });

    it('returns null for an id no lead has', async () => {
      const res = await gql<{ lead: null }>(LEAD, { id: '01a0d358-0000-7000-8000-000000000000' }, adminToken);
      expect(res.errors).toBeUndefined();
      expect(res.data!.lead).toBeNull();
    });

    it('rejects an id that is not a UUID', async () => {
      expect(error(await gql(LEAD, { id: '42' }, adminToken))?.extensions?.fields).toHaveProperty('id');
    });

    it('needs an ADMIN token', async () => {
      expect(error(await gql(LEAD, { id: '01a0d358-0000-7000-8000-000000000000' }, userToken))?.extensions?.code).toBe('FORBIDDEN');
    });
  });
});
