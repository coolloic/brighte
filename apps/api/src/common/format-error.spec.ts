import { Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { BadUserInputError } from './errors.js';
import { formatError } from './format-error.js';

describe('formatError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes an error with a client-facing code through unchanged', () => {
    const error = new BadUserInputError('Password too short');
    const formatted = { message: error.message, path: ['createUser'], extensions: { code: 'BAD_USER_INPUT' } };
    expect(formatError(formatted, error)).toBe(formatted);
  });

  it('masks an internal error and logs the original', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const original = new Error('duplicate key value violates unique constraint "users_email_key"');
    const wrapped = new GraphQLError(original.message, { originalError: original });
    const formatted = {
      message: original.message,
      locations: [{ line: 1, column: 12 }],
      path: ['createUser'],
      extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['Error: duplicate key ...'] },
    };

    expect(formatError(formatted, wrapped)).toEqual({
      message: 'Internal server error',
      locations: [{ line: 1, column: 12 }],
      path: ['createUser'],
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    expect(log).toHaveBeenCalledWith(original.message, original.stack);
  });
});
