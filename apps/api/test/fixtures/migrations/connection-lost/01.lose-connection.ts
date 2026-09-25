import { QueryTypes, Sequelize } from 'sequelize';
import type { Migration } from '../../../../src/database/migrator.js';

// Loses its database connection between two statements (as a network blip or a proxy would):
// the first statement dies with it, and the pool quietly opens a new connection for the second.
export const up: Migration = async ({ context: q }) => {
  const [{ pid }] = await q.sequelize.query<{ pid: number }>('SELECT pg_backend_pid() AS pid', { type: QueryTypes.SELECT });
  await q.sequelize.query('CREATE TABLE before_loss (id int)');

  const { database, username, password, host, port } = q.sequelize.config;
  const killer = new Sequelize(database, username, password ?? undefined, { host, port: Number(port), dialect: 'postgres', logging: false });
  await killer.query('SELECT pg_terminate_backend(:pid)', { replacements: { pid } });
  await killer.close();
  await new Promise((resolve) => setTimeout(resolve, 200));

  await q.sequelize.query('CREATE TABLE after_loss (id int)');
};
export const down: Migration = async () => {};
