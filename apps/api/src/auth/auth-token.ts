import type { Role } from './role.enum.js';

/**
 * Claims carried by an access token. `auth_time` (the standard OIDC claim) is when the user signed
 * in, in seconds since the epoch; renewals keep it, so a session can't be renewed forever.
 */
export type AuthTokenPayload = { sub: number; role: Role; auth_time?: number };
