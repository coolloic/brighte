import { ForbiddenException, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokenPayload } from './auth-token.js';
import { getRequest, IS_PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import type { Role } from './role.enum.js';

/**
 * Global guard, deny by default:
 * 1. Every handler needs a valid bearer token unless marked @Public().
 * 2. Handlers marked @Roles(...) also need the token's role to be listed.
 * Throws Nest HTTP exceptions, not GraphQL errors, because it also guards REST routes;
 * the Apollo driver maps them to UNAUTHENTICATED / FORBIDDEN.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = getRequest(ctx);
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');

    let payload: AuthTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    req.user = { id: payload.sub, role: payload.role };

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(payload.role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
