import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { RateLimits, ThrottlePerMinute } from '../common/index.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth-user.js';
import { CurrentUser, Public } from './decorators.js';
import { AuthPayload } from './dto/auth-payload.js';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Public()
  // Slows password guessing; the per-IP limit does not stop a distributed attack (see README).
  @ThrottlePerMinute(RateLimits.login)
  @Mutation(() => AuthPayload, {
    description: [
      'Exchange email and password for an access token. Email is case-insensitive.',
      '**Auth:** Public.',
      '**Errors:** `UNAUTHENTICATED` (wrong email or password; the same message for both), `TOO_MANY_REQUESTS` (more than 10 attempts a minute from one IP by default).',
    ].join('\n\n'),
  })
  login(@Args('email') email: string, @Args('password') password: string): Promise<AuthPayload> {
    return this.auth.login(email, password);
  }

  @Mutation(() => AuthPayload, {
    description: [
      'Exchange a valid access token for a fresh one, keeping the sign-in time, so an active session goes on without signing in again. Renewals stop `SESSION_MAX_HOURS` (8 by default) after signing in, and a renewed token never lasts past that. The account is read again: a role change applies, and a deleted account can no longer renew.',
      '**Auth:** any signed-in user.',
      '**Errors:** `UNAUTHENTICATED` (missing, invalid or expired token; the account no longer exists; or the session has reached its limit).',
    ].join('\n\n'),
  })
  renewToken(@CurrentUser() caller: AuthUser): Promise<AuthPayload> {
    return this.auth.renew(caller);
  }
}
