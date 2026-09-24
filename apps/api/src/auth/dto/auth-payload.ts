import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/user.model.js';

@ObjectType()
export class AuthPayload {
  @Field({ description: 'JWT to send as `Authorization: Bearer <token>`.' })
  accessToken: string;

  @Field(() => User)
  user: User;
}
