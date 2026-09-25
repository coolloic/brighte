import { z } from 'zod';

// Server-side rules for leads. The server is the source of truth; the web form mirrors
// these for fast feedback, but anything reaching the API is checked here.

const AU_MOBILE = /^(?:\+?61|0)4\d{8}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name is too long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255, 'Email is too long')
    .pipe(z.email('Enter a valid email address')),
  // Accepts 04xx xxx xxx, +614xxxxxxxx or 614xxxxxxxx; stored as 04xxxxxxxx.
  mobile: z
    .string()
    .transform((s) => s.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(AU_MOBILE, 'Enter an Australian mobile number, e.g. 0412 345 678'))
    .transform((s) => `0${s.slice(-9)}`),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter a 4-digit postcode'),
  // Codes only: whether each one exists and is active is checked against service_types,
  // so a new service type needs a row, not a code change.
  services: z
    .array(z.string().trim().min(1))
    .min(1, 'Choose at least one service')
    .max(20, 'Too many services')
    .transform((codes) => [...new Set(codes)]),
});

export type RegisterInput = z.output<typeof registerSchema>;

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
});

export const leadIdSchema = z.object({ id: z.uuid('Not a valid lead id') });
