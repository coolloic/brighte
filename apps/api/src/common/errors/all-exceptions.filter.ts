import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { GqlArgumentsHost, type GqlContextType } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { UniqueConstraintError } from 'sequelize';
import { redact } from '../logging/redact.js';
import { AppError } from './app.error.js';
import type { ErrorCode } from './error-codes.js';

const HTTP_STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

/**
 * Global error handler for REST and GraphQL.
 * - Logs the real error with request context (secrets redacted).
 * - Returns only a stable code, a user-friendly message and the matching HTTP status.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorHandler');

  catch(exception: unknown, host: ArgumentsHost) {
    const appError = toAppError(exception);
    const isGraphql = host.getType<GqlContextType>() === 'graphql';
    const req = isGraphql
      ? GqlArgumentsHost.create(host).getContext<{ req: Request }>().req
      : host.switchToHttp().getRequest<Request>();

    this.log(appError, exception, req, isGraphql ? host : undefined);

    const body = {
      code: appError.code,
      message: appError.userMessage,
      ...(appError.details && { details: appError.details }),
    };

    if (isGraphql) {
      // Apollo uses extensions.http.status as the HTTP response status and strips it from the body.
      return new GraphQLError(body.message, {
        extensions: {
          code: body.code,
          ...(body.details && { details: body.details }),
          http: { status: appError.status },
        },
      });
    }

    host.switchToHttp().getResponse<Response>().status(appError.status).json({ error: body });
  }

  private log(appError: AppError, exception: unknown, req: Request | undefined, gqlHost?: ArgumentsHost) {
    const info = gqlHost ? GqlArgumentsHost.create(gqlHost).getInfo<{ fieldName: string; parentType: { name: string } }>() : undefined;
    const context = {
      code: appError.code,
      status: appError.status,
      operation: info ? `${info.parentType.name}.${info.fieldName}` : `${req?.method} ${req?.originalUrl}`,
      args: gqlHost ? redact(GqlArgumentsHost.create(gqlHost).getArgs()) : undefined,
      requestId: req?.headers['x-request-id'],
      userId: (req as Request & { user?: { sub?: number } })?.user?.sub,
      ip: req?.ip,
      error: exception instanceof Error ? exception.message : String(exception),
    };

    if (appError.status >= 500) {
      this.logger.error(context, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(context);
    }
  }
}

function toAppError(exception: unknown): AppError {
  if (exception instanceof AppError) return exception;
  if (exception instanceof UniqueConstraintError) {
    return new AppError('CONFLICT', undefined, exception.message);
  }
  if (exception instanceof HttpException) {
    const code = HTTP_STATUS_TO_CODE[exception.getStatus()] ?? 'INTERNAL_ERROR';
    return new AppError(code, undefined, exception.message);
  }
  return new AppError('INTERNAL_ERROR');
}
