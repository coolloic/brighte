import * as z from 'zod/mini';

// Input rules shared by the API and the web forms. The API parses every request with them and is
// the source of truth; the web checks the same rules in the browser first, so mistakes show at
// once and never count against the API's rate limits. zod/mini keeps the browser bundle small.
// Messages may end in an example ("…, e.g. 0412 345 678"); the web form drops it, since the
// field's hint already shows one.

const AU_MOBILE = /^(?:\+?61|0)4\d{8}$/;

/** Longest full name accepted, after trimming. */
export const MAX_NAME_LENGTH = 70;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_SEARCH_LENGTH = 100;

/** Trimmed and lowercased, then checked with zod's email pattern. */
export const emailSchema = z.pipe(
  z.string().check(z.trim(), z.toLowerCase(), z.maxLength(MAX_EMAIL_LENGTH, 'Email is too long')),
  z.email('Enter a valid email address'),
);

export const registrationSchema = z.object({
  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, 'Name is required'),
      z.maxLength(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer`),
    ),
  email: emailSchema,
  // Accepts 04xx xxx xxx, +614xxxxxxxx or 614xxxxxxxx; normalised to 04xxxxxxxx.
  mobile: z.pipe(
    z.pipe(
      z.string(),
      z.transform((s) => s.replace(/[\s()-]/g, '')),
    ),
    z.pipe(
      z.string().check(z.regex(AU_MOBILE, 'Enter an Australian mobile number, e.g. 0412 345 678')),
      z.transform((s) => `0${s.slice(-9)}`),
    ),
  ),
  postcode: z.string().check(z.trim(), z.regex(/^\d{4}$/, 'Enter a 4-digit postcode')),
  // Codes only: whether each one exists and is active is up to the API's database.
  services: z.pipe(
    z
      .array(z.string().check(z.trim(), z.minLength(1)))
      .check(z.minLength(1, 'Choose at least one service'), z.maxLength(20, 'Too many services')),
    z.transform((codes) => [...new Set(codes)]),
  ),
});

export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

/**
 * The sign-in form. The API doesn't parse login input: a malformed email is simply a wrong one
 * (UNAUTHENTICATED), so this only saves a request that can't succeed.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().check(z.minLength(1, 'Enter your password')),
});

/** The first message for each invalid field, keyed by its top-level name. */
export function messagesByField(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[String(issue.path[0] ?? 'input')] ??= issue.message;
  return fields;
}
