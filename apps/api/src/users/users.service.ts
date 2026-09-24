import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model.js';
import { CreateUserInput } from './create-user.input.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  findAll(): Promise<User[]> {
    return this.userModel.findAll({ order: [['id', 'ASC']] });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.userModel.create({ email: input.email, name: input.name });
  }
}
