import { Injectable, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import { Throttle, ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { TooManyRequestsError } from './errors.js';

export const RATE_LIMIT_WINDOW_MS = 60_000;

// Read on every request, so limits change with the environment without a rebuild (and tests
// can tighten them). Counted per client IP and per operation: see TRUST_PROXY in app.setup.ts.
const perMinute = (name: string, fallback: number) => () => Number(process.env[name]) || fallback;

export const RateLimits = {
  default: perMinute('RATE_LIMIT_PER_MINUTE', 120),
  login: perMinute('RATE_LIMIT_LOGIN_PER_MINUTE', 10),
  register: perMinute('RATE_LIMIT_REGISTER_PER_MINUTE', 5),
};

/** Replace the default limit on one operation, e.g. `@ThrottlePerMinute(RateLimits.login)`. */
export const ThrottlePerMinute = (limit: () => number) =>
  Throttle({ default: { limit, ttl: RATE_LIMIT_WINDOW_MS } });

/**
 * ThrottlerGuard that also understands GraphQL. Guards run once per root field, so aliasing
 * one mutation many times in a single request is counted per alias, not per request.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
    if (context.getType<GqlContextType>() !== 'graphql') return super.getRequestResponse(context);
    const { req, res } = GqlExecutionContext.create(context).getContext<{ req: Request; res: Response }>();
    return { req, res };
  }

  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    if (context.getType<GqlContextType>() !== 'graphql') return super.throwThrottlingException(context, detail);
    throw new TooManyRequestsError(detail.timeToBlockExpire);
  }
}
