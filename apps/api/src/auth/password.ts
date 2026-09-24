import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from 'node:crypto';

// Also imported by the seed script under Node type stripping: keep it free of
// relative imports and TS-only syntax (enums, decorators, parameter properties).

const SALT_BYTES = 16;
const KEY_BYTES = 64;

const derive = (password: string, salt: BinaryLike) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_BYTES, (err, key) => (err ? reject(err) : resolve(key))),
  );

/** Returns `scrypt$<salt>$<hash>` (base64), safe to store. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Constant-time check of `password` against a value from `hashPassword`. False if `stored` is malformed. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64, ...rest] = stored.split('$');
  if (scheme !== 'scrypt' || saltB64 === undefined || keyB64 === undefined || rest.length > 0) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;

  return timingSafeEqual(await derive(password, salt), expected);
}
