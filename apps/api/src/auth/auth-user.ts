import type { Role } from './role.enum.js';

/** The authenticated caller, taken from a verified access token. */
export type AuthUser = {
  id: number;
  role: Role;
  /** When they signed in (seconds since the epoch); undefined for tokens issued before sessions had a limit. */
  authTime?: number;
};
