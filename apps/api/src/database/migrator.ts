import { pathToFileURL } from 'node:url';
import { QueryTypes, Sequelize, type QueryInterface } from 'sequelize';
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

/** pg_advisory_lock key shared by every migration run against a database. Any constant works. */
export const MIGRATION_LOCK_KEY = 4_242_001;
const LOCK_POLL_MS = 500;

/**
 * Runs `fn` while holding the migration lock, waiting for any other run to finish first.
 * Polls pg_try_advisory_lock rather than blocking in pg_advisory_lock: a session blocked inside
 * pg_advisory_lock holds a snapshot, and CREATE INDEX CONCURRENTLY in the run that owns the lock
 * waits for every older snapshot, so the two would deadlock.
 */
export async function withMigrationLock<T>(sequelize: Sequelize, fn: () => Promise<T>, log: (message: string) => void = console.log): Promise<T> {
  const replacements = { key: MIGRATION_LOCK_KEY };
  let announced = false;
  for (;;) {
    const [{ locked }] = await sequelize.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(:key) AS locked', {
      replacements,
      type: QueryTypes.SELECT,
    });
    if (locked) break;
    if (!announced) log('Another migration run holds the lock; waiting for it to finish');
    announced = true;
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  try {
    return await fn();
  } finally {
    await sequelize.query('SELECT pg_advisory_unlock(:key)', { replacements });
  }
}

/**
 * Runs a migration command under the lock. When it fails, the open migration is rolled back while
 * the lock is still held: after a SQL error the transaction is aborted and Postgres refuses every
 * statement until ROLLBACK, the unlock included. Resolves to whether the command succeeded.
 */
export async function runLocked(
  sequelize: Sequelize,
  { rollback }: { rollback: () => Promise<void> },
  command: () => Promise<boolean>,
  log?: (message: string) => void,
): Promise<boolean> {
  return withMigrationLock(
    sequelize,
    async () => {
      let succeeded = false;
      try {
        succeeded = await command();
      } finally {
        if (!succeeded) await rollback();
      }
      return succeeded;
    },
    log,
  );
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
