import type { Migration } from '../../../../src/database/migrator.js';

// A concurrent build while the other runner waits: the case that deadlocks with pg_advisory_lock.
export const transaction = false;

export const up: Migration = async ({ context: q }) => {
  await q.sequelize.query('CREATE INDEX CONCURRENTLY s_name ON s (name)');
};
export const down: Migration = async ({ context: q }) => {
  await q.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS s_name');
};
