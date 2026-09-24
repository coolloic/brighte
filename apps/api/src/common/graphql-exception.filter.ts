import { Catch, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';

/**
 * Hands resolver errors straight to Apollo, where `formatError` logs and masks the unexpected ones.
 * Without it Nest logs every non-HTTP exception, including expected client errors like CONFLICT.
 * REST errors keep Nest's default handling.
 */
@Catch()
export class GraphqlExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() === 'graphql') return exception;
    super.catch(exception, host);
  }
}
