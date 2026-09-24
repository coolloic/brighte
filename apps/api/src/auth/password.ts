import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

function scrypt(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key))),
  );
}
const KEY_LENGTH = 64;

/** Returns `salt:hash` (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
