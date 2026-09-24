import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service.js';
import { AuthPayload } from './dto/auth-payload.js';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Mutation(() => AuthPayload, { description: 'Exchange email and password for an access token.' })
  login(@Args('email') email: string, @Args('password') password: string): Promise<AuthPayload> {
    return this.auth.login(email, password);
  }
}
