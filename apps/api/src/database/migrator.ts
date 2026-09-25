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
  const umzug = new Umzug({
    migrations: {
      glob,
      // Record names without extension so dev (.ts) and prod (.js) runs match.
      resolve: ({ name, path }) => ({
        name: name.slice(0, -ext.length),
        up: async (params) => (await load(path!)).up(params),
        down: async (params) => (await load(path!)).down(params),
      }),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger,
  });
  return { umzug, rollback: async () => {} };
}
