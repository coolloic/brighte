import { emailSchema, MAX_NAME_LENGTH } from '@brighte/validation';
import { z } from 'zod';
import { Role } from '../auth/index.js';

// Server-side rules for createUser. The email rules are the shared ones, so an address stored here
// is one the sign-in form (which also trims and lowercases) can match.

export const MIN_PASSWORD_LENGTH = 8;
// Bounds the work scrypt does for one request.
export const MAX_PASSWORD_LENGTH = 128;

export const createUserSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer`),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`),
  role: z.enum(Role),
});

export type CreateUser = z.output<typeof createUserSchema>;
