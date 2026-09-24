import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';
import type { Role } from './role.enum.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Skip authentication. Every use must match the access rules in the auth design spec. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Allow only callers with one of these roles (on top of being authenticated). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthRequest = Request & { user?: AuthUser };

export function getRequest(ctx: ExecutionContext): AuthRequest {
  return ctx.getType<string>() === 'graphql'
    ? GqlExecutionContext.create(ctx).getContext<{ req: AuthRequest }>().req
    : ctx.switchToHttp().getRequest<AuthRequest>();
}

/** The authenticated caller. Only valid on handlers that are not @Public(). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => getRequest(ctx).user!);
