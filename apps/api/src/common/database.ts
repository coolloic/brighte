import type { SequelizeOptions } from 'sequelize-typescript';

const DEFAULT_POOL_MAX = 10;
const DEFAULT_POOL_IDLE_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 5_000;

// Anything but a positive whole number falls back to the default.
const positiveInt = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

type Connection = { host: string; port: number; username: string; password: string; database: string };

const connection = (url: string): Connection => {
  const { hostname, port, username, password, pathname } = new URL(url);
  return {
    host: hostname,
    port: Number(port || 5432),
    username: decodeURIComponent(username),
    password: decodeURIComponent(password),
    database: decodeURIComponent(pathname.slice(1)),
  };
};

/**
 * Reads from a replica when `DATABASE_READ_URL` is set (Sequelize replication): a query outside a
 * transaction goes to the replica, and writes and transactions to `DATABASE_URL`. A replica is a
 * little behind, so a read right after a write may not see it yet (e.g. a new lead on the dashboard).
 * Each side gets its own pool of `DB_POOL_MAX` connections. Unset, everything uses `DATABASE_URL`.
 */
export function replicationOptions(env: NodeJS.ProcessEnv = process.env): Pick<SequelizeOptions, 'replication'> {
  if (!env.DATABASE_READ_URL || !env.DATABASE_URL) return {};
  return { replication: { read: [connection(env.DATABASE_READ_URL)], write: connection(env.DATABASE_URL) } };
}

/**
 * Connection pool and timeouts for the API's database connection. Without them Sequelize allows 5
 * connections, a request waits up to 60s for one, and a slow query holds its connection forever.
 * - `DB_POOL_MAX` (default 10): connections per API instance. Keep instances × this under Postgres's
 *   `max_connections` (100 by default), leaving room for migrations and admin sessions.
 * - `DB_POOL_IDLE_MS` (default 10000): an unused connection is closed after this long, so a quiet
 *   instance holds none and never reuses one a proxy or NAT silently dropped (they do after minutes).
 *   Raise it (e.g. 60000) if reconnecting after quiet periods shows in latency, e.g. TLS to a managed database.
 * - `DB_STATEMENT_TIMEOUT_MS` (default 5000): Postgres cancels a statement that runs longer.
 */
export function databaseOptions(env: NodeJS.ProcessEnv = process.env): Pick<SequelizeOptions, 'pool' | 'dialectOptions'> {
  return {
    pool: {
      max: positiveInt(env.DB_POOL_MAX, DEFAULT_POOL_MAX),
      min: 0,
      // Fail a request after 5s without a free connection, rather than queue it past any HTTP timeout.
      acquire: 5_000,
      idle: positiveInt(env.DB_POOL_IDLE_MS, DEFAULT_POOL_IDLE_MS),
    },
    // Set by Postgres on each connection (node-postgres client options).
    dialectOptions: {
      statement_timeout: positiveInt(env.DB_STATEMENT_TIMEOUT_MS, DEFAULT_STATEMENT_TIMEOUT_MS),
      // A transaction left open (a bug, a hung request) is ended instead of holding locks and a connection.
      idle_in_transaction_session_timeout: 10_000,
      // Shows in pg_stat_activity, so the database side can tell the API's connections apart.
      application_name: 'brighte-api',
    },
  };
}
