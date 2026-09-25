import { Sequelize } from 'sequelize';
// `.ts` (rewritten to `.js` on build) because this script runs under Node type stripping.
import { hashPassword } from '../auth/password.ts';
import { SEED_EMAIL_DOMAIN, seedLeads } from './seed-leads.ts';

// Dev-only: creates or updates the seed accounts (matched by email), and adds the sample leads
// that aren't there yet.

const MIN_PASSWORD_LENGTH = 8;

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed: NODE_ENV is production');
}

function requirePassword(name: string): string {
  const value = process.env[name];
  if (!value || value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${name} must be set and at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return value;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const seeds = [
  { email: 'admin@brighte.dev', name: 'Admin', role: 'ADMIN', password: requirePassword('SEED_ADMIN_PASSWORD') },
  { email: 'user@brighte.dev', name: 'User', role: 'USER', password: requirePassword('SEED_USER_PASSWORD') },
];

const sequelize = new Sequelize(databaseUrl, { logging: false });

try {
  for (const seed of seeds) {
    await sequelize.query(
      `INSERT INTO users (email, name, role, "passwordHash", "createdAt", "updatedAt")
       VALUES (:email, :name, :role, :passwordHash, now(), now())
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, role = EXCLUDED.role,
             "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = now()`,
      {
        replacements: {
          email: seed.email,
          name: seed.name,
          role: seed.role,
          passwordHash: await hashPassword(seed.password),
        },
      },
    );
    console.log(`seeded ${seed.email} (${seed.role})`);
  }
  const added = await seedLeads(sequelize);
  console.log(`seeded ${added} sample leads (@${SEED_EMAIL_DOMAIN})${added === 0 ? ': all there already' : ''}`);
} finally {
  await sequelize.close();
}
