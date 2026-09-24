import { Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../auth/role.enum.js';
import { User } from './user.model.js';
import { UsersService } from './users.service.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, {
    description: [
      'The signed-in user.',
      '**Auth:** Any signed-in user (returns only the caller).',
      '**Errors:** `UNAUTHENTICATED` (401), `NOT_FOUND` (404).',
    ].join('\n\n'),
  })
  me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.usersService.findById(user.sub);
  }

  @Roles(Role.ADMIN)
  @Query(() => [User], {
    description: [
      'All users, ordered by id.',
      '**Auth:** `ADMIN` role.',
      '**Errors:** `UNAUTHENTICATED` (401), `FORBIDDEN` (403).',
    ].join('\n\n'),
  })
  users(): Promise<User[]> {
    return this.usersService.findAll();
  }
}
