import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

@InputType({ description: 'Details for creating a new account.' })
export class RegisterInput {
  @Field({ description: 'Email address, used to sign in. Case-insensitive.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @Field({ description: 'Display name, 1–100 characters.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters.' })
  name: string;

  @Field({ description: 'Password, 12–128 characters.' })
  @IsString()
  @Length(12, 128, { message: 'Password must be between 12 and 128 characters.' })
  password: string;
}
