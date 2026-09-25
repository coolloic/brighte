import { Injectable, Logger, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import { Throttle, ThrottlerGuard, type ThrottlerLimitDetail, type ThrottlerRequest } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { TooManyRequestsError } from './errors.js';

const logger = new Logger('RateLimit');

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

/** Each new block lasts twice as long as the one before, for the same client and operation. */
export const BACKOFF_FACTOR = 2;
/** The longest a block can last. */
export const MAX_BLOCK_MS = 15 * 60_000;
/** A client that stays unblocked this long after a block starts again from the base block. */
export const BACKOFF_RESET_MS = 15 * 60_000;

/**
 * Exponential backoff for repeat offenders. The throttler blocks a client that goes over a limit
 * for `blockDuration`; this remembers how many blocks each key (client + operation) has had and
 * doubles the next one: 60s, 120s, 240s… up to MAX_BLOCK_MS. In memory, like the throttler's own
 * counters, so each API instance counts separately.
 */
export class RateLimitBackoff {
  private readonly records = new Map<string, { blocks: number; blockedUntil: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** How long a block starting now would last for this key. */
  blockDuration(key: string, baseMs: number): number {
    const blocks = this.current(key)?.blocks ?? 0;
    return Math.min(baseMs * BACKOFF_FACTOR ** blocks, Math.max(baseMs, MAX_BLOCK_MS));
  }

  /**
   * Called for every blocked request; counts a new block only once, when it starts. Returns the
   * key's block count when a new block starts (1 for the first), undefined during a block.
   */
  recordBlock(key: string, retryAfterSeconds: number): number | undefined {
    const now = this.now();
    const record = this.current(key);
    if (record && record.blockedUntil > now) return undefined; // still the same block
    const blocks = (record?.blocks ?? 0) + 1;
    this.records.set(key, { blocks, blockedUntil: now + retryAfterSeconds * 1000 });
    this.forgetQuietKeys(now);
    return blocks;
  }

  private current(key: string) {
    const record = this.records.get(key);
    if (record && this.now() - record.blockedUntil > BACKOFF_RESET_MS) {
      this.records.delete(key);
      return undefined;
    }
    return record;
  }

  private forgetQuietKeys(now: number) {
    for (const [key, record] of this.records) if (now - record.blockedUntil > BACKOFF_RESET_MS) this.records.delete(key);
  }
}

/**
 * ThrottlerGuard that also understands GraphQL. Guards run once per root field, so aliasing
 * one mutation many times in a single request is counted per alias, not per request.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  private readonly backoff = new RateLimitBackoff();

  /** Same as the base guard, but a repeat offender's next block is longer (see RateLimitBackoff). */
  protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const { req } = this.getRequestResponse(props.context);
    const tracker = await props.getTracker(req, props.context);
    const key = props.generateKey(props.context, tracker, props.throttler.name ?? 'default');
    return super.handleRequest({ ...props, blockDuration: this.backoff.blockDuration(key, props.blockDuration) });
  }

  protected getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
    if (context.getType<GqlContextType>() !== 'graphql') return super.getRequestResponse(context);
    const { req, res } = GqlExecutionContext.create(context).getContext<{ req: Request; res: Response }>();
    return { req, res };
  }

  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const blocks = this.backoff.recordBlock(detail.key, detail.timeToBlockExpire);
    // Once per block, not per refused request: repeated blocks for one client are the sign of password guessing.
    if (blocks) {
      logger.warn({
        msg: 'Rate limit block started',
        event: 'rate_limit.blocked',
        operation: context.getHandler().name,
        ip: detail.tracker,
        limit: detail.limit,
        blockSeconds: detail.timeToBlockExpire,
        blocks,
      });
    }
    if (context.getType<GqlContextType>() !== 'graphql') return super.throwThrottlingException(context, detail);
    throw new TooManyRequestsError(detail.timeToBlockExpire);
  }
}
