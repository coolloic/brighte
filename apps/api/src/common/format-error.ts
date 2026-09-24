import { ApolloServerErrorCode, unwrapResolverError } from '@apollo/server/errors';
import { Logger } from '@nestjs/common';
import type { GraphQLFormattedError } from 'graphql';

const logger = new Logger('GraphQL');

/**
 * Apollo `formatError`. Errors with a client-facing code pass through unchanged. Anything
 * unexpected (INTERNAL_SERVER_ERROR) is logged with its stack, then replaced by a generic
 * message so database or library details never reach the client.
 */
export function formatError(formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  if (formatted.extensions?.code !== ApolloServerErrorCode.INTERNAL_SERVER_ERROR) return formatted;

  const original = unwrapResolverError(error);
  logger.error(formatted.message, original instanceof Error ? original.stack : undefined);
  return {
    message: 'Internal server error',
    locations: formatted.locations,
    path: formatted.path,
    extensions: { code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR },
  };
}
