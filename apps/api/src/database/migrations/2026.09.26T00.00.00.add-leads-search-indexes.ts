import type { Migration } from '../migrate.js';

// The leads search matches name and email anywhere in the text (ILIKE '%term%'), which a normal
// B-tree index can't serve. Trigram GIN indexes can, so search stays fast as leads grow. pg_trgm
// is a trusted extension (Postgres 13+): the database owner can create it without superuser.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await queryInterface.sequelize.query('CREATE INDEX leads_name_trgm ON leads USING gin (name gin_trgm_ops)');
  await queryInterface.sequelize.query('CREATE INDEX leads_email_trgm ON leads USING gin (email gin_trgm_ops)');
};

// The extension stays: other objects may use it, and it is harmless on its own.
export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS leads_email_trgm');
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS leads_name_trgm');
};
