import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, Role, Roles, type AuthUser } from '../auth/index.js';
import { User } from './user.model.js';
import { UsersService } from './users.service.js';
import { CreateUserInput } from './create-user.input.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN, Role.USER)
  @Query(() => User, {
    description: [
      'The signed-in user.',
      '**Auth:** `ADMIN` or `USER`.',
      '**Errors:** `UNAUTHENTICATED` (missing, invalid or expired token, or the account no longer exists).',
    ].join('\n\n'),
  })
  me(@CurrentUser() caller: AuthUser): Promise<User> {
    return this.usersService.findCaller(caller.id);
  }

  @Roles(Role.ADMIN)
  @Query(() => [User], {
    description: [
      'All users, ordered by id.',
      '**Auth:** `ADMIN`.',
      '**Errors:** `UNAUTHENTICATED`, `FORBIDDEN` (caller is not `ADMIN`).',
    ].join('\n\n'),
  })
  users(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Roles(Role.ADMIN)
  @Mutation(() => User, {
    description: [
      'Create a user. `role` defaults to `USER`; the email is stored lowercase.',
      '**Auth:** `ADMIN`.',
      '**Errors:** `UNAUTHENTICATED`, `FORBIDDEN` (caller is not `ADMIN`), `BAD_USER_INPUT` (password shorter than 8 characters), `CONFLICT` (email already registered).',
    ].join('\n\n'),
  })
  createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.usersService.create(input);
  }
}
