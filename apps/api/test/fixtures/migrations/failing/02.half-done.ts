import type { Migration } from '../../../../src/database/migrator.js';

export const up: Migration = async ({ context: q }) => {
  await q.sequelize.query('CREATE TABLE b (id int)');
  throw new Error('boom after creating b');
};
export const down: Migration = async ({ context: q }) => {
  await q.sequelize.query('DROP TABLE IF EXISTS b');
};
