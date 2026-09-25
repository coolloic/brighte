import { registrationSchema } from '@brighte/validation';
import type { Sequelize } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { v7 as uuidv7 } from 'uuid';

// Dev-only sample leads, so a fresh setup has enough data to page through, search, filter and
// sort without registering leads by hand. Deterministic: the same leads (names, emails, mobiles,
// postcodes, services) every time, with emails on seed.example.com so they're easy to tell apart.

export const SEED_LEAD_COUNT = 150;
export const SEED_EMAIL_DOMAIN = 'seed.example.com';

const FIRST_NAMES = [
  'Olivia', 'Jack', 'Charlotte', 'Noah', 'Amelia', 'William', 'Isla', 'Oliver', 'Mia', 'Thomas',
  'Ava', 'James', 'Grace', 'Lucas', 'Chloe', 'Henry', 'Zoe', 'Liam', 'Ruby', 'Ethan',
  'Priya', 'Wei', 'Aisha', 'Mateo', 'Sienna', 'Hiroshi', 'Fatima', 'Aroha', 'Dmitri', 'Leilani',
];
const LAST_NAMES = [
  'Smith', 'Nguyen', 'Williams', 'Brown', 'Wilson', 'Taylor', "O'Brien", 'Chen', 'Patel', 'Kelly',
  'Martin', 'Singh', 'Anderson', 'Rossi', 'Walker', 'Kim', 'Harris', 'Nguyen-Tran', 'Murphy', 'Papadopoulos',
  'Lee', 'MacDonald', 'Wright', 'Kowalski', 'Thompson', 'Ali', 'Scott', 'Hughes', 'Garcia', 'Robinson',
];
// Capital-city and suburban postcodes, so a postcode search ("20", "3000") finds several leads.
const POSTCODES = [
  '2000', '2010', '2026', '2060', '2150', '2600', '3000', '3121', '3181', '3350',
  '4000', '4101', '4217', '5000', '5067', '6000', '6160', '7000', '0800', '0870',
];
// Service combinations, by code. Every lead has at least one; some have all three.
const SERVICE_SETS = [['delivery'], ['pick-up'], ['payment'], ['delivery', 'pick-up'], ['delivery', 'payment'], ['pick-up', 'payment'], ['delivery', 'pick-up', 'payment']];

const HOUR = 60 * 60 * 1000;

export type SeedLead = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  postcode: string;
  services: string[];
  createdAt: Date;
};

/**
 * The sample leads, newest first: one about every 14 hours back from `now` (about 3 months for
 * 150). Parsed with the API's own registration rules, so a seed lead is always one the API
 * could have accepted.
 */
export function buildSeedLeads(now: Date, count = SEED_LEAD_COUNT): SeedLead[] {
  return Array.from({ length: count }, (_, i) => {
    // Stepping through the lists at different rates, shifted on each pass through the first names,
    // so no two leads share a full name.
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7 + Math.floor(i / FIRST_NAMES.length)) % LAST_NAMES.length];
    const local = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    const input = registrationSchema.parse({
      name: `${first} ${last}`,
      email: `${local}.${i + 1}@${SEED_EMAIL_DOMAIN}`,
      mobile: `04${String(10_000_000 + i * 523_171).slice(-8)}`,
      postcode: POSTCODES[(i * 3) % POSTCODES.length],
      services: SERVICE_SETS[(i * 5) % SERVICE_SETS.length],
    });
    const createdAt = new Date(now.getTime() - i * 14 * HOUR);
    return { ...input, id: uuidv7({ msecs: createdAt.getTime() }), createdAt };
  });
}

/**
 * Inserts the sample leads that aren't there yet (matched by email), with their services, in one
 * transaction. Leads that already exist are left as they are. Returns how many were added.
 */
export async function seedLeads(sequelize: Sequelize, now = new Date()): Promise<number> {
  const serviceTypes = await sequelize.query<{ id: number; code: string }>('SELECT id, code FROM service_types', { type: QueryTypes.SELECT });
  const serviceId = new Map(serviceTypes.map((row) => [row.code, row.id]));

  return sequelize.transaction(async (transaction) => {
    let added = 0;
    for (const lead of buildSeedLeads(now)) {
      const inserted = await sequelize.query<{ id: string }>(
        `INSERT INTO leads (id, name, email, mobile, postcode, "createdAt", "updatedAt")
         VALUES (:id, :name, :email, :mobile, :postcode, :createdAt, :createdAt)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        { replacements: lead, type: QueryTypes.SELECT, transaction },
      );
      if (inserted.length === 0) continue;
      for (const code of lead.services) {
        const serviceTypeId = serviceId.get(code);
        if (serviceTypeId === undefined) throw new Error(`Service type "${code}" is missing: run pnpm db:migrate first`);
        await sequelize.query(
          `INSERT INTO lead_service_types ("leadId", "serviceTypeId", "createdAt") VALUES (:leadId, :serviceTypeId, :createdAt)`,
          { replacements: { leadId: lead.id, serviceTypeId, createdAt: lead.createdAt }, transaction },
        );
      }
      added++;
    }
    return added;
  });
}
