import { Field, InputType } from '@nestjs/graphql';

// No `role`: until access control lands, anyone can call createUser, so it always creates a USER.
@InputType()
export class CreateUserInput {
  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ description: 'At least 8 characters.' })
  password: string;
}
