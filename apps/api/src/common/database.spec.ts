import { databaseOptions, replicationOptions } from './database.js';

describe('databaseOptions', () => {
  it('bounds the pool: 10 connections, 5s to get one', () => {
    expect(databaseOptions({}).pool).toEqual({ max: 10, min: 0, acquire: 5_000, idle: 10_000 });
  });

  it('has Postgres end slow statements and abandoned transactions, and name the connections', () => {
    expect(databaseOptions({}).dialectOptions).toEqual({
      statement_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
      application_name: 'brighte-api',
    });
  });

  it('reads the pool size, idle time and statement timeout from the environment', () => {
    const options = databaseOptions({ DB_POOL_MAX: '25', DB_POOL_IDLE_MS: '60000', DB_STATEMENT_TIMEOUT_MS: '15000' });
    expect(options.pool).toMatchObject({ max: 25, idle: 60_000 });
    expect(options.dialectOptions).toMatchObject({ statement_timeout: 15_000 });
  });

  it.each(['0', '-1', '2.5', 'abc', ''])('falls back to the default for %j', (value) => {
    const options = databaseOptions({ DB_POOL_MAX: value, DB_POOL_IDLE_MS: value, DB_STATEMENT_TIMEOUT_MS: value });
    expect(options.pool).toMatchObject({ max: 10, idle: 10_000 });
    expect(options.dialectOptions).toMatchObject({ statement_timeout: 5_000 });
  });
});

describe('replicationOptions', () => {
  it('reads from DATABASE_READ_URL and writes to DATABASE_URL', () => {
    expect(
      replicationOptions({
        DATABASE_URL: 'postgres://app:s%3Acret@db-rw:5432/brighte',
        DATABASE_READ_URL: 'postgres://app:s%3Acret@db-ro/brighte',
      }),
    ).toEqual({
      replication: {
        write: { host: 'db-rw', port: 5432, username: 'app', password: 's:cret', database: 'brighte' },
        read: [{ host: 'db-ro', port: 5432, username: 'app', password: 's:cret', database: 'brighte' }],
      },
    });
  });

  it('adds nothing without a read URL, so everything uses DATABASE_URL', () => {
    expect(replicationOptions({ DATABASE_URL: 'postgres://app:x@db/brighte' })).toEqual({});
    expect(replicationOptions({ DATABASE_URL: 'postgres://app:x@db/brighte', DATABASE_READ_URL: '' })).toEqual({});
  });
});
