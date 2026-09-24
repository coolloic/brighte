import type { z } from 'zod';
import { BadUserInputError } from './errors.js';

/** Parse `input` with `schema`, or throw BAD_USER_INPUT with the first message per field. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'input');
    fields[field] ??= issue.message;
  }
  throw new BadUserInputError('Invalid input', fields);
}
