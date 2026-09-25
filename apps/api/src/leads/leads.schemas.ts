import { MAX_NAME_LENGTH, MAX_SEARCH_LENGTH, registrationSchema, type Registration } from '@brighte/validation';
import { z } from 'zod';

// Server-side rules for leads. The registration rules live in @brighte/validation
// (packages/validation), which the web form checks too; the server is the source of truth.

export { MAX_NAME_LENGTH, MAX_SEARCH_LENGTH };
export const registerSchema = registrationSchema;
export type RegisterInput = Registration;

export const MAX_LEADS_LIMIT = 100;

export const leadsArgsSchema = z.object({
  limit: z.int().min(1, 'limit must be at least 1').max(MAX_LEADS_LIMIT, `limit must be at most ${MAX_LEADS_LIMIT}`),
  offset: z.int().min(0, 'offset must be 0 or more'),
  // Blank, null or omitted means no filter. null is valid GraphQL for this nullable argument, and
  // an "All services" option can send "".
  serviceType: z
    .string()
    .trim()
    .nullish()
    .transform((code) => code || undefined),
  // Same for search: blank, null or omitted means no search.
  search: z
    .string()
    .trim()
    .max(MAX_SEARCH_LENGTH, `search must be at most ${MAX_SEARCH_LENGTH} characters`)
    .nullish()
    .transform((text) => text || undefined),
});

export const leadIdSchema = z.object({ id: z.uuid('Not a valid lead id') });
