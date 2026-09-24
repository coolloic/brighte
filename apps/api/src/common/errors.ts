import { ApolloServerErrorCode } from '@apollo/server/errors';
import { GraphQLError } from 'graphql';

// Errors a client is expected to handle. Clients branch on `extensions.code`, never on the message.
// No `extensions.http`: Nest resets the status to 200 once an operation has executed.

/** `fields` maps each invalid argument to a message, so a form can show it next to the input. */
export class BadUserInputError extends GraphQLError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT, ...(fields && { fields }) } });
  }
}

export class UnauthenticatedError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'UNAUTHENTICATED' } });
  }
}

export class ConflictError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'CONFLICT' } });
  }
}

/** Rate limit hit. `retryAfter` is in seconds; the Retry-After header carries the same value. */
export class TooManyRequestsError extends GraphQLError {
  constructor(retryAfter: number) {
    super('Too many requests, try again later', { extensions: { code: 'TOO_MANY_REQUESTS', retryAfter } });
  }
}
