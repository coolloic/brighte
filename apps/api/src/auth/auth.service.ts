import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UniqueConstraintError } from 'sequelize';
import { AppError } from '../common/errors/app.error.js';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';
import type { AuthPayload } from './dto/auth-payload.js';
import type { LoginInput } from './dto/login.input.js';
import type { RegisterInput } from './dto/register.input.js';
import { hashPassword, verifyPassword } from './password.js';

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = await hashPassword('timing-attack-mitigation');

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    try {
      const user = await this.users.create({
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      });
      return this.issue(user);
    } catch (err) {
      if (err instanceof UniqueConstraintError) throw new AppError('EMAIL_TAKEN', undefined, err.message);
      throw err;
    }
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const user = await this.users.findByEmailWithPassword(input.email);
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new AppError('INVALID_CREDENTIALS');
    return this.issue(user);
  }

  private async issue(user: AuthPayload['user']): Promise<AuthPayload> {
    const claims: AuthUser = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(claims), user };
  }
}
