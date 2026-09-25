import type { Migration } from '../../../../src/database/migrator.js';

// Holds the lock long enough for a second runner to wait for it.
export const up: Migration = async ({ context: q }) => {
  await q.sequelize.query('CREATE TABLE s (name text)');
  await q.sequelize.query('SELECT pg_sleep(1)');
};
export const down: Migration = async ({ context: q }) => {
  await q.sequelize.query('DROP TABLE s');
};
