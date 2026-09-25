import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthenticatedError } from '../common/index.js';
import { UsersService, type User } from '../users/index.js';
import type { AuthTokenPayload } from './auth-token.js';
import type { AuthUser } from './auth-user.js';
import { hashPassword, verifyPassword } from './password.js';

const INVALID_CREDENTIALS = 'Invalid email or password';
const SESSION_EXPIRED = 'Session expired, sign in again';

const nowSeconds = () => Math.floor(Date.now() / 1000);

@Injectable()
export class AuthService {
  // Verified against when the email is unknown, so both failures take the same time.
  private readonly dummyHash = hashPassword('dummy-password-for-timing');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const user = await this.users.findByEmailWithPassword(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) throw new UnauthenticatedError(INVALID_CREDENTIALS);

    const payload: AuthTokenPayload = { sub: user.id, role: user.role, auth_time: nowSeconds() };
    const accessToken = await this.jwt.signAsync(payload);
    user.set('passwordHash', undefined);
    return { accessToken, user };
  }

  /**
   * A fresh token for a signed-in caller, keeping their sign-in time: an active session goes on
   * without signing in again, up to SESSION_MAX_HOURS after signing in. The account is read again,
   * so a role change applies and a deleted account can't renew.
   */
  async renew(caller: AuthUser): Promise<{ accessToken: string; user: User }> {
    const now = nowSeconds();
    const sessionEnd = (caller.authTime ?? 0) + this.sessionMaxSeconds();
    // Tokens from before sessions had a limit carry no auth_time: those sign in again.
    if (!caller.authTime || now >= sessionEnd) throw new UnauthenticatedError(SESSION_EXPIRED);

    const user = await this.users.findCaller(caller.id);
    const payload: AuthTokenPayload = { sub: user.id, role: user.role, auth_time: caller.authTime };
    let accessToken = await this.jwt.signAsync(payload);
    // Never valid past the session's end.
    if (this.jwt.decode<{ exp: number }>(accessToken).exp > sessionEnd) {
      accessToken = await this.jwt.signAsync(payload, { expiresIn: sessionEnd - now });
    }
    return { accessToken, user };
  }

  /** Read on every call, like the rate limits, so it changes with the environment. */
  private sessionMaxSeconds(): number {
    const hours = Number(this.config.get<string>('SESSION_MAX_HOURS') ?? 8);
    return (Number.isFinite(hours) && hours > 0 ? hours : 8) * 3600;
  }
}
