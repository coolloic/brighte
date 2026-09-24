import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { hashPassword } from '../auth/password.js';
import { User } from './user.model.js';
import { CreateUserInput } from './create-user.input.js';

export const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  findAll(): Promise<User[]> {
    return this.userModel.findAll({ order: [['id', 'ASC']] });
  }

  /** For the authenticated caller: a token for a deleted user is no longer valid. */
  async findCaller(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }

  /** Includes passwordHash: for credential checks only, never return it to a client. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userModel.scope('withPassword').findOne({ where: { email: email.toLowerCase() } });
  }

  async create(input: CreateUserInput): Promise<User> {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const user = await this.userModel.create({
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    });
    // Reload through the default scope so the hash is not carried on the returned instance.
    return this.userModel.findByPk(user.id, { rejectOnEmpty: true });
  }
}
