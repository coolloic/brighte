import { existsSync } from 'node:fs';
import { QueryTypes, Sequelize } from 'sequelize';
import { createMigrator, migrationSequelize, withMigrationLock } from '../src/database/migrator.js';

// The e2e suites get DATABASE_URL from apps/api/.env through ConfigModule; this one never boots
// the app, so it reads the file itself (CI sets the variable directly).
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

const FIXTURES = `${import.meta.dirname}/fixtures/migrations`;
const silent = { info() {}, warn() {}, error() {}, debug() {} };

describe('Migration runner (e2e)', () => {
  let admin: Sequelize;
  const databases: string[] = [];
  const open: Sequelize[] = [];

  /** A new, empty database for one test, and a single-connection Sequelize on it. */
  async function freshDatabase(): Promise<{ url: string; sequelize: Sequelize }> {
    const name = `migrator_test_${Date.now()}_${databases.length}`;
    await admin.query(`CREATE DATABASE ${name}`);
    databases.push(name);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${name}`;
    const sequelize = migrationSequelize(url.toString());
    open.push(sequelize);
    return { url: url.toString(), sequelize };
  }

  const migratorFor = (sequelize: Sequelize, dir: string) =>
    createMigrator(sequelize, { glob: `${FIXTURES}/${dir}/*.ts`, ext: '.ts', logger: silent });

  const tables = async (sequelize: Sequelize) =>
    (await sequelize.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'", { type: QueryTypes.SELECT }))
      .map((row) => row.tablename)
      // Sorted in JS, not SQL: the database collation would put 'a' before 'SequelizeMeta'.
      .sort();

  beforeAll(() => {
    admin = new Sequelize(process.env.DATABASE_URL!, { logging: false });
  });

  afterAll(async () => {
    await Promise.all(open.map((sequelize) => sequelize.close()));
    for (const name of databases) await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.close();
  });

  it('rolls back a failing migration: nothing it did stays, and it is not recorded', async () => {
    const { sequelize } = await freshDatabase();
    const { umzug, rollback } = migratorFor(sequelize, 'failing');

    await expect(umzug.up()).rejects.toThrow(/boom after creating b/);
    await rollback();

    expect(await tables(sequelize)).toEqual(['SequelizeMeta', 'a']);
    expect((await umzug.executed()).map((m) => m.name)).toEqual(['01.create-a']);
  });

  it('runs each migration inside a transaction', async () => {
    const { sequelize } = await freshDatabase();
    const { umzug, rollback } = migratorFor(sequelize, 'index-in-transaction');

    await expect(umzug.up()).rejects.toThrow(/cannot run inside a transaction block/);
    await rollback();
    expect((await umzug.executed()).map((m) => m.name)).toEqual(['01.create-t']);
  });

  it('runs a migration that exports transaction = false outside a transaction', async () => {
    const { sequelize } = await freshDatabase();
    const { umzug } = migratorFor(sequelize, 'index-concurrently');

    await umzug.up();
    const [index] = await sequelize.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE indexname = 't_name'", {
      type: QueryTypes.SELECT,
    });
    expect(index).toEqual({ indexname: 't_name' });
  });

  it('reverts inside a transaction and unrecords the migration', async () => {
    const { sequelize } = await freshDatabase();
    const { umzug } = migratorFor(sequelize, 'index-concurrently');
    await umzug.up();

    await umzug.down({ to: 0 });

    expect(await tables(sequelize)).toEqual(['SequelizeMeta']);
    expect(await umzug.executed()).toEqual([]);
  });

  it('lets only one run migrate at a time; the other waits, then finds nothing to do', async () => {
    const { url, sequelize: first } = await freshDatabase();
    const second = migrationSequelize(url);
    open.push(second);
    const runner = (sequelize: Sequelize) => {
      const { umzug } = migratorFor(sequelize, 'slow');
      return withMigrationLock(sequelize, () => umzug.up(), () => {});
    };

    const [a, b] = await Promise.all([runner(first), runner(second)]);

    expect([a.length, b.length].sort()).toEqual([0, 2]);
    const rows = await first.query<{ name: string }>('SELECT name FROM "SequelizeMeta" ORDER BY name', { type: QueryTypes.SELECT });
    expect(rows.map((row) => row.name)).toEqual(['01.create-s', '02.index-s']);
  }, 20_000);
});
