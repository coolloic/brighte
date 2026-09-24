import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppError } from '../common/errors/app.error.js';
import { User } from './user.model.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  findAll(): Promise<User[]> {
    return this.userModel.findAll({ order: [['id', 'ASC']] });
  }

  async findById(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new AppError('NOT_FOUND', undefined, `user ${id} not found`);
    return user;
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userModel.scope('withPassword').findOne({ where: { email } });
  }

  async create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    const user = await this.userModel.create(data);
    // Re-read through the default scope so the hash is not carried on the returned instance.
    return this.findById(user.id);
  }
}
