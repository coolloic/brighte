import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from './user.model.js';
import { UsersService } from './users.service.js';
import { CreateUserInput } from './create-user.input.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  users(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Mutation(() => User)
  createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.usersService.create(input);
  }
}
