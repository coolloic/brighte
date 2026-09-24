import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';
import type { Role } from './role.enum.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Opt out of authentication. Every use must be justified in the API spec. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict to the given roles (in addition to being authenticated). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export function getRequest(ctx: ExecutionContext): Request & { user?: AuthUser } {
  return ctx.getType<string>() === 'graphql'
    ? GqlExecutionContext.create(ctx).getContext<{ req: Request }>().req
    : ctx.switchToHttp().getRequest<Request>();
}

/** The authenticated caller. Only valid on non-@Public handlers. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => getRequest(ctx).user!,
);
