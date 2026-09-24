import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service.js';
import { Public } from './decorators.js';
import { AuthPayload } from './dto/auth-payload.js';
import { LoginInput } from './dto/login.input.js';
import { RegisterInput } from './dto/register.input.js';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Public() // Anonymous callers must be able to create an account.
  @Mutation(() => AuthPayload, { description: 'Create an account (role USER) and sign in.' })
  register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.auth.register(input);
  }

  @Public() // Anonymous callers must be able to sign in.
  @Mutation(() => AuthPayload, { description: 'Sign in with email and password.' })
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.auth.login(input);
  }
}
