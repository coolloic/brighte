import { extname } from 'node:path';
import { createMigrator, migrationSequelize, withMigrationLock } from './migrator.ts';

export type { Migration } from './migrator.ts';

// Runs as `.ts` via Node type stripping in dev and as compiled `.js` from dist,
// so it globs migrations with its own extension.
const ext = extname(import.meta.filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const sequelize = migrationSequelize(databaseUrl);
const { umzug, rollback } = createMigrator(sequelize, { glob: `${import.meta.dirname}/migrations/*${ext}`, ext });

// runAsCLI reports a failure by resolving false (and setting process.exitCode), not by throwing.
let succeeded = false;
try {
  succeeded = await withMigrationLock(sequelize, () => umzug.runAsCLI());
} finally {
  if (!succeeded) await rollback();
  await sequelize.close();
}
