import type { Migration } from '../../../../src/database/migrator.js';

export const transaction = false;

export const up: Migration = async ({ context: q }) => {
  await q.sequelize.query('CREATE INDEX CONCURRENTLY t_name ON t (name)');
};
export const down: Migration = async ({ context: q }) => {
  await q.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS t_name');
};
