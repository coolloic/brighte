import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service.js';
import { Public } from './decorators.js';
import { AuthPayload } from './dto/auth-payload.js';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Mutation(() => AuthPayload, {
    description: [
      'Exchange email and password for an access token. Email is case-insensitive.',
      '**Auth:** Public.',
      '**Errors:** `UNAUTHENTICATED` (wrong email or password; the same message for both).',
    ].join('\n\n'),
  })
  login(@Args('email') email: string, @Args('password') password: string): Promise<AuthPayload> {
    return this.auth.login(email, password);
  }
}
