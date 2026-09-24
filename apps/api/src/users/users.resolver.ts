import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../auth/role.enum.js';
import { User } from './user.model.js';
import { UsersService } from './users.service.js';
import { CreateUserInput } from './create-user.input.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN, Role.USER)
  @Query(() => User, { description: 'The signed-in user.' })
  me(@CurrentUser() caller: AuthUser): Promise<User> {
    return this.usersService.findCaller(caller.id);
  }

  @Roles(Role.ADMIN)
  @Query(() => [User])
  users(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Roles(Role.ADMIN)
  @Mutation(() => User)
  createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.usersService.create(input);
  }
}
