import { pathToFileURL } from 'node:url';
import { Sequelize, type QueryInterface } from 'sequelize';
import { SequelizeStorage, Umzug, type MigrationFn, type UmzugOptions } from 'umzug';

// Also imported by migrate.ts under Node type stripping: keep it free of TS-only syntax
// (enums, decorators, parameter properties) and import siblings with `.ts`.

export type Migration = MigrationFn<QueryInterface>;

type MigrationModule = { up: Migration; down: Migration; transaction?: boolean };

/**
 * A Sequelize instance with exactly one connection, kept open for the whole run: BEGIN/COMMIT and
 * the advisory lock belong to a connection, so every query of a migration (and its SequelizeMeta
 * row) must go through the same one.
 */
export function migrationSequelize(databaseUrl: string): Sequelize {
  const forever = 2_147_483_647;
  return new Sequelize(databaseUrl, { logging: false, pool: { max: 1, min: 1, idle: forever, evict: forever } });
}

export function createMigrator(
  sequelize: Sequelize,
  { glob, ext, logger = console }: { glob: string; ext: string; logger?: UmzugOptions['logger'] },
) {
  const load = (path: string) => import(pathToFileURL(path).href) as Promise<MigrationModule>;

  // A migration's transaction stays open until Umzug has written (or deleted) its SequelizeMeta
  // row, so the change and the record of it commit together.
  let inTransaction = false;
  const begin = async () => {
    await sequelize.query('BEGIN');
    inTransaction = true;
  };
  const commit = async () => {
    if (!inTransaction) return;
    inTransaction = false;
    await sequelize.query('COMMIT');
  };
  /** Undoes the migration that failed: call it after a failed run. */
  const rollback = async () => {
    if (!inTransaction) return;
    inTransaction = false;
    await sequelize.query('ROLLBACK');
  };

  /** Runs one direction of a migration, in a transaction unless the module exports `transaction = false`. */
  const run =
    (path: string, direction: 'up' | 'down'): Migration =>
    async (params) => {
      const migration = await load(path);
      // CREATE INDEX CONCURRENTLY (and a few other statements) can't run inside a transaction.
      if (migration.transaction !== false) await begin();
      return migration[direction](params);
    };

  const umzug = new Umzug({
    migrations: {
      glob,
      // Record names without extension so dev (.ts) and prod (.js) runs match.
      resolve: ({ name, path }) => ({ name: name.slice(0, -ext.length), up: run(path!, 'up'), down: run(path!, 'down') }),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger,
  });
  umzug.on('migrated', commit);
  umzug.on('reverted', commit);

  return { umzug, rollback };
}
