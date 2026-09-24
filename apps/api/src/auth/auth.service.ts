import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthenticatedError } from '../common/errors.js';
import { UsersService } from '../users/users.service.js';
import type { User } from '../users/user.model.js';
import type { AuthTokenPayload } from './auth-token.js';
import { hashPassword, verifyPassword } from './password.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  // Verified against when the email is unknown, so both failures take the same time.
  private readonly dummyHash = hashPassword('dummy-password-for-timing');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const user = await this.users.findByEmailWithPassword(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) throw new UnauthenticatedError(INVALID_CREDENTIALS);

    const payload: AuthTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    user.set('passwordHash', undefined);
    return { accessToken, user };
  }
}
