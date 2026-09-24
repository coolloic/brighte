import type { Role } from './role.enum.js';

/** The authenticated caller, taken from a verified access token. */
export type AuthUser = { id: number; role: Role };
