import type { Migration } from '../../../../src/database/migrator.js';

export const up: Migration = async ({ context: q }) => {
  await q.sequelize.query('CREATE TABLE a (id int)');
};
export const down: Migration = async ({ context: q }) => {
  await q.sequelize.query('DROP TABLE a');
};
