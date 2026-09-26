import type { Migration } from '../migrate.js';

// The leads search is one OR across name, email, postcode and mobile. Postgres can combine indexes
// for an OR (BitmapOr) only when every branch has one; without these two it scanned the whole
// table on every search, and the load test measured 42 searches a second on 164k leads. Postcode
// matches from the start (LIKE 'term%'): text_pattern_ops lets a B-tree serve that whatever the
// database's collation. Mobile matches digits anywhere (LIKE '%123%'): a trigram GIN index, as
// for name and email (pg_trgm comes from the add-leads-search-indexes migration).
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query('CREATE INDEX leads_postcode_prefix ON leads (postcode text_pattern_ops)');
  await queryInterface.sequelize.query('CREATE INDEX leads_mobile_trgm ON leads USING gin (mobile gin_trgm_ops)');
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS leads_mobile_trgm');
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS leads_postcode_prefix');
};
