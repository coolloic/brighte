import { extname } from 'node:path';
import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

// Runs as `.ts` via Node type stripping in dev and as compiled `.js` from dist,
// so it globs migrations with its own extension.
const ext = extname(import.meta.filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const sequelize = new Sequelize(databaseUrl, { logging: false });

const umzug = new Umzug({
  migrations: {
    glob: `${import.meta.dirname}/migrations/*${ext}`,
    // Record names without extension so dev (.ts) and prod (.js) runs match.
    resolve: (params) => ({
      ...Umzug.defaultResolver(params),
      name: params.name.slice(0, -ext.length),
    }),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

export type Migration = typeof umzug._types.migration;

try {
  await umzug.runAsCLI();
} finally {
  await sequelize.close();
}
