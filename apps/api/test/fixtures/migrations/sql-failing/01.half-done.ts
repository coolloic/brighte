import type { Migration } from '../../../../src/database/migrator.js';

// Fails in SQL, which aborts the transaction: until ROLLBACK, Postgres refuses every statement.
export const up: Migration = async ({ context: q }) => {
  await q.sequelize.query('CREATE TABLE c (id int)');
  await q.sequelize.query('SELECT * FROM no_such_table');
};
export const down: Migration = async () => {};
