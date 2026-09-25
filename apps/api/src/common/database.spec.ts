import { databaseOptions } from './database.js';

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

  it('reads the pool size and statement timeout from the environment', () => {
    const options = databaseOptions({ DB_POOL_MAX: '25', DB_STATEMENT_TIMEOUT_MS: '15000' });
    expect(options.pool?.max).toBe(25);
    expect(options.dialectOptions).toMatchObject({ statement_timeout: 15_000 });
  });

  it.each(['0', '-1', '2.5', 'abc', ''])('falls back to the default for %j', (value) => {
    const options = databaseOptions({ DB_POOL_MAX: value, DB_STATEMENT_TIMEOUT_MS: value });
    expect(options.pool?.max).toBe(10);
    expect(options.dialectOptions).toMatchObject({ statement_timeout: 5_000 });
  });
});
