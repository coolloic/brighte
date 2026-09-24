import { ApolloServerErrorCode } from '@apollo/server/errors';
import { GraphQLError } from 'graphql';

// Errors a client is expected to handle. Clients branch on `extensions.code`, never on the message.
// No `extensions.http`: Nest resets the status to 200 once an operation has executed.

export class BadUserInputError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
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
