import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { hashPassword } from '../auth/index.js';
import { ConflictError, UnauthenticatedError } from '../common/index.js';
import { User } from './user.model.js';
import type { CreateUser } from './users.schemas.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  findAll(): Promise<User[]> {
    return this.userModel.findAll({ order: [['id', 'ASC']] });
  }

  /** For the authenticated caller: a token for a deleted user is no longer valid. */
  async findCaller(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new UnauthenticatedError('User no longer exists');
    return user;
  }

  /** Includes passwordHash: for credential checks only, never return it to a client. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userModel.scope('withPassword').findOne({ where: { email: email.toLowerCase() } });
  }

  /** `input` is already validated and normalised (createUserSchema). */
  async create(input: CreateUser): Promise<User> {
    const user = await this.userModel
      .create({
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      })
      .catch((err: unknown) => {
        if (err instanceof UniqueConstraintError) throw new ConflictError('Email is already registered');
        throw err;
      });
    // Reload through the default scope so the hash is not carried on the returned instance.
    return this.userModel.findByPk(user.id, { rejectOnEmpty: true });
  }
}
