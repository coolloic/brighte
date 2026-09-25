import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, isNonNullType } from 'graphql';
import { leadsArgsSchema, MAX_NAME_LENGTH, registerSchema } from './leads.schemas.js';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  mobile: '0412345678',
  postcode: '2000',
  services: ['delivery'],
};

const fieldErrors = (input: unknown) => {
  const result = registerSchema.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('registerSchema', () => {
  it('normalises a valid registration', () => {
    expect(
      registerSchema.parse({
        name: '  Ada Lovelace ',
        email: ' Ada@Example.COM ',
        mobile: '+61 412 345 678',
        postcode: ' 2000 ',
        services: ['delivery', 'payment', 'delivery'],
      }),
    ).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      mobile: '0412345678',
      postcode: '2000',
      services: ['delivery', 'payment'],
    });
  });

  it.each(['0412 345 678', '0412-345-678', '+61412345678', '61412345678', '(04) 1234 5678'])('accepts mobile %s', (mobile) => {
    expect(registerSchema.parse({ ...valid, mobile }).mobile).toMatch(/^04\d{8}$/);
  });

  // Guards against a required field quietly becoming optional.
  it.each(['name', 'email', 'mobile', 'postcode', 'services'] as const)('requires %s', (field) => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest[field];
    expect(fieldErrors(rest)).toHaveProperty(field);
    expect(fieldErrors({ ...valid, [field]: field === 'services' ? [] : '   ' })).toHaveProperty(field);
  });

  it.each([
    ['email', 'not-an-email'],
    ['mobile', '0212345678'],
    ['mobile', '041234567'],
    ['postcode', '200'],
    ['postcode', 'ABCD'],
  ])('rejects %s %s', (field, value) => {
    expect(fieldErrors({ ...valid, [field]: value })).toHaveProperty(field);
  });

  it('accepts a full name of up to 70 characters, and rejects a longer one', () => {
    expect(MAX_NAME_LENGTH).toBe(70);
    expect(fieldErrors({ ...valid, name: 'x'.repeat(70) })).toEqual({});
    // Counted after trimming: surrounding spaces don't count.
    expect(fieldErrors({ ...valid, name: `  ${'x'.repeat(70)}  ` })).toEqual({});
    expect(fieldErrors({ ...valid, name: 'x'.repeat(71) })).toEqual({ name: 'Name must be 70 characters or fewer' });
  });

  it('leaves service codes to the database: an unseen code passes schema validation', () => {
    expect(registerSchema.parse({ ...valid, services: ['catering'] }).services).toEqual(['catering']);
  });
});

describe('leadsArgsSchema search', () => {
  const args = { limit: 20, offset: 0 };

  it.each([undefined, null, '', '   '])('treats search %j as no search', (search) => {
    expect(leadsArgsSchema.parse({ ...args, search }).search).toBeUndefined();
  });

  it('trims the search and allows up to 100 characters', () => {
    expect(leadsArgsSchema.parse({ ...args, search: '  ada  ' }).search).toBe('ada');
    expect(leadsArgsSchema.parse({ ...args, search: 'x'.repeat(100) }).search).toHaveLength(100);
    expect(leadsArgsSchema.safeParse({ ...args, search: 'x'.repeat(101) }).success).toBe(false);
  });
});

describe('register in the published schema', () => {
  it('keeps every argument required', () => {
    const schema = buildSchema(readFileSync(join(import.meta.dirname, '../schema.gql'), 'utf8'));
    const register = schema.getMutationType()!.getFields().register;
    const args = Object.fromEntries(register.args.map((a) => [a.name, isNonNullType(a.type)]));
    expect(args).toEqual({ name: true, email: true, mobile: true, postcode: true, services: true });
  });
});

describe('leadsArgsSchema', () => {
  it.each([undefined, null, '', '   '])('treats serviceType %j as no filter', (serviceType) => {
    expect(leadsArgsSchema.parse({ limit: 20, offset: 0, serviceType }).serviceType).toBeUndefined();
  });

  it('trims a service type code', () => {
    expect(leadsArgsSchema.parse({ limit: 20, offset: 0, serviceType: ' pick-up ' }).serviceType).toBe('pick-up');
  });
});
