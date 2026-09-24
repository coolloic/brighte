import type { Role } from './role.enum.js';

/** Claims carried by an access token. */
export type AuthTokenPayload = { sub: number; role: Role };
