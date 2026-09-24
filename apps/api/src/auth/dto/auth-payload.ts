import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/user.model.js';

@ObjectType({ description: 'Result of a successful sign-in or registration.' })
export class AuthPayload {
  @Field({ description: 'JWT to send as `Authorization: Bearer <token>`.' })
  accessToken: string;

  @Field(() => User, { description: 'The signed-in user.' })
  user: User;
}
