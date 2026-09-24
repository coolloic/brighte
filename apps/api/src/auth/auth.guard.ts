import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../common/errors/app.error.js';
import type { AuthUser } from './auth-user.js';
import { getRequest, IS_PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import type { Role } from './role.enum.js';

/**
 * Global guard, deny by default:
 * 1. Authentication: every handler requires a valid bearer token unless marked @Public().
 * 2. Authorization: handlers marked @Roles(...) additionally require one of those roles.
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
    if (scheme !== 'Bearer' || !token) throw new AppError('UNAUTHENTICATED', undefined, 'missing bearer token');

    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token, { algorithms: ['HS256'] });
    } catch (err) {
      throw new AppError('UNAUTHENTICATED', undefined, `invalid token: ${(err as Error).message}`);
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(req.user.role)) {
      throw new AppError('FORBIDDEN', undefined, `role ${req.user.role} not in [${roles.join(', ')}]`);
    }
    return true;
  }
}
