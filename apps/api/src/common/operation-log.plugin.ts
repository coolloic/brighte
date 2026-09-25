import type { ApolloServerPlugin } from '@apollo/server';
import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import { Kind } from 'graphql';

const logger = new Logger('GraphQL');

// Only what's logged. `user` is set by the auth guard (AuthUser), once a resolver has run.
type OperationContext = { req?: Request & { user?: { id: unknown; role: unknown } } };

/**
 * One log line per GraphQL operation: its name, root fields, duration, caller and error codes.
 * Info when it succeeds, warn when it returns errors (formatError also logs unexpected ones with
 * their stack). Never logs variables: login and register carry passwords and personal details.
 */
export const operationLogPlugin: ApolloServerPlugin<OperationContext> = {
  requestDidStart() {
    const start = performance.now();
    return Promise.resolve({
      willSendResponse({ operationName, operation, response, contextValue: { req } }) {
        const errors = response.body.kind === 'single' ? response.body.singleResult.errors : undefined;
        const codes = [...new Set(errors?.map(({ extensions }) => (typeof extensions?.code === 'string' ? extensions.code : 'UNKNOWN')))];
        const entry = {
          operation: operationName ?? undefined,
          type: operation?.operation,
          fields: operation?.selectionSet.selections.flatMap((s) => (s.kind === Kind.FIELD ? [s.name.value] : [])),
          durationMs: Math.round(performance.now() - start),
          userId: req?.user?.id,
          role: req?.user?.role,
          ip: req?.ip,
        };
        if (codes.length) logger.warn({ msg: 'GraphQL operation failed', ...entry, errors: codes });
        else logger.log({ msg: 'GraphQL operation', ...entry });
        return Promise.resolve();
      },
    });
  },
};
