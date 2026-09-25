// Creates the local env files from their examples (pnpm bootstrap). Safe to run again: an existing
// file is kept, and only an empty JWT_SECRET is filled in.
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT_ENV = '.env';
const API_ENV = 'apps/api/.env';

if (!existsSync(ROOT_ENV)) {
  copyFileSync('.env.example', ROOT_ENV);
  console.log(`Created ${ROOT_ENV} (ports)`);
}

if (!existsSync(API_ENV)) {
  // DATABASE_URL carries the Postgres port: take it from the root .env, like Docker Compose does.
  const postgresPort = readFileSync(ROOT_ENV, 'utf8').match(/^POSTGRES_PORT=(\d+)/m)?.[1] ?? '5435';
  const example = readFileSync('apps/api/.env.example', 'utf8');
  writeFileSync(API_ENV, example.replace(/^(DATABASE_URL=.*@localhost:)\d+/m, `$1${postgresPort}`));
  console.log(`Created ${API_ENV}`);
}

const api = readFileSync(API_ENV, 'utf8');
if (/^JWT_SECRET=\s*$/m.test(api)) {
  writeFileSync(API_ENV, api.replace(/^JWT_SECRET=\s*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`));
  console.log(`Set a random JWT_SECRET in ${API_ENV}`);
}
