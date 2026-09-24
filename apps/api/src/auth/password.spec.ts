import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('verifies the password it hashed', async () => {
    const stored = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse');
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('does not store the plain password', async () => {
    expect(await hashPassword('correct horse')).not.toContain('correct horse');
  });

  it.each(['', 'plain', 'scrypt$only-salt', 'bcrypt$a$b', 'scrypt$!!$!!'])(
    'returns false for malformed stored value %j',
    async (stored) => {
      expect(await verifyPassword('anything', stored)).toBe(false);
    },
  );
});
