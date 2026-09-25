import { Role } from '../auth/index.js';
import { createUserSchema, MAX_PASSWORD_LENGTH } from './users.schemas.js';

const valid = { email: 'bob@example.com', name: 'Bob', password: 'bob-password', role: Role.USER };

const fieldErrors = (input: unknown) => {
  const result = createUserSchema.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('createUserSchema', () => {
  it('trims and lowercases the email and trims the name, so the user can sign in', () => {
    expect(createUserSchema.parse({ ...valid, email: ' Bob@Example.COM ', name: '  Bob  ' })).toEqual({
      ...valid,
      email: 'bob@example.com',
      name: 'Bob',
    });
  });

  it('keeps the password exactly as given', () => {
    expect(createUserSchema.parse({ ...valid, password: ' spaced password ' }).password).toBe(' spaced password ');
  });

  it.each([
    ['an invalid email', { email: 'not-an-email' }, 'email'],
    ['an email over 255 characters', { email: `${'a'.repeat(250)}@example.com` }, 'email'],
    ['a blank name', { name: '   ' }, 'name'],
    ['a name over 70 characters', { name: 'a'.repeat(71) }, 'name'],
    ['a password under 8 characters', { password: '1234567' }, 'password'],
    ['a password over the maximum', { password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1) }, 'password'],
  ])('rejects %s', (_label, change, field) => {
    expect(Object.keys(fieldErrors({ ...valid, ...change }))).toEqual([field]);
  });
});
