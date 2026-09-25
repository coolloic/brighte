import { messagesByField } from '@brighte/validation';
import { z } from 'zod';
import { BadUserInputError } from './errors.js';

/** Parse `input` with `schema` (zod or zod/mini), or throw BAD_USER_INPUT with the first message per field. */
export function validate<T extends z.core.$ZodType>(schema: T, input: unknown): z.output<T> {
  const result = z.safeParse(schema, input);
  if (result.success) return result.data;
  throw new BadUserInputError('Invalid input', messagesByField(result.error.issues));
}
