import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, isNonNullType } from 'graphql';
import { registerSchema } from './leads.schemas.js';

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

  it('leaves service codes to the database: an unseen code passes schema validation', () => {
    expect(registerSchema.parse({ ...valid, services: ['catering'] }).services).toEqual(['catering']);
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
