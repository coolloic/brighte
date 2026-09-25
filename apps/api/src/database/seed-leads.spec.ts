import { buildSeedLeads, SEED_EMAIL_DOMAIN, SEED_LEAD_COUNT } from './seed-leads.ts';

describe('buildSeedLeads', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  const leads = buildSeedLeads(now);

  // Ids have random bits, so only the rest is compared; re-seeding matches leads by email.
  it('is the same data every run, so re-seeding adds nothing', () => {
    const withoutIds = (list: typeof leads) => list.map((lead) => ({ ...lead, id: undefined }));
    expect(withoutIds(buildSeedLeads(now))).toEqual(withoutIds(leads));
  });

  it('has enough leads for several pages, each with a different email and name', () => {
    expect(leads).toHaveLength(SEED_LEAD_COUNT);
    expect(SEED_LEAD_COUNT).toBeGreaterThan(100); // more than one page at the largest page size
    expect(new Set(leads.map((lead) => lead.email)).size).toBe(SEED_LEAD_COUNT);
    expect(new Set(leads.map((lead) => lead.name)).size).toBe(SEED_LEAD_COUNT);
    expect(leads.every((lead) => lead.email.endsWith(`@${SEED_EMAIL_DOMAIN}`))).toBe(true);
  });

  it('spreads leads back in time, newest first, with ids in the same order', () => {
    expect(leads[0].createdAt).toEqual(now);
    for (let i = 1; i < leads.length; i++) {
      expect(leads[i].createdAt.getTime()).toBeLessThan(leads[i - 1].createdAt.getTime());
      expect(leads[i].id < leads[i - 1].id).toBe(true); // UUID v7 sorts by time
    }
  });

  it('uses every service', () => {
    expect(new Set(leads.flatMap((lead) => lead.services))).toEqual(new Set(['delivery', 'pick-up', 'payment']));
  });
});
