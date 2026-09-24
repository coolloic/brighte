import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Credentials for signing in.' })
export class LoginInput {
  @Field({ description: 'Account email address.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @Field({ description: 'Account password.' })
  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(128)
  password: string;
}
