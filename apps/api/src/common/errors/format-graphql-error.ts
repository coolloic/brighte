import type { GraphQLFormattedError } from 'graphql';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { ERRORS, type ErrorCode } from './error-codes.js';

const REQUEST_ERROR_CODES = new Set<string>([
  ApolloServerErrorCode.GRAPHQL_PARSE_FAILED,
  ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED,
  ApolloServerErrorCode.BAD_USER_INPUT,
  ApolloServerErrorCode.BAD_REQUEST,
  ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE,
  ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND,
  ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED,
]);

/**
 * Last line of defence for GraphQL responses. Resolver errors are already shaped by
 * AllExceptionsFilter; this handles errors Apollo raises before resolvers run
 * (malformed query, bad variables) and guarantees nothing internal leaks.
 */
export function formatGraphqlError(formatted: GraphQLFormattedError): GraphQLFormattedError {
  const code = formatted.extensions?.code as string | undefined;
  const base = { locations: formatted.locations, path: formatted.path };

  if (code && code in ERRORS) {
    return {
      ...base,
      message: formatted.message,
      extensions: { code, ...(formatted.extensions?.details ? { details: formatted.extensions.details } : {}) },
    };
  }
  if (code && REQUEST_ERROR_CODES.has(code)) {
    // Describes the client's own query, so the message is safe and useful to keep.
    return { ...base, message: formatted.message, extensions: { code: 'BAD_REQUEST' satisfies ErrorCode } };
  }
  return { ...base, message: ERRORS.INTERNAL_ERROR.message, extensions: { code: 'INTERNAL_ERROR' satisfies ErrorCode } };
}
