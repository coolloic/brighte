import { Field, InputType } from '@nestjs/graphql';
import { Role } from '../auth/role.enum.js';

@InputType()
export class CreateUserInput {
  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ description: 'At least 8 characters.' })
  password: string;

  @Field(() => Role, { defaultValue: Role.USER })
  role: Role;
}
