import type { Role } from './role.enum.js';

/** Claims carried in the access token and attached to the request as `req.user`. */
export interface AuthUser {
  sub: number;
  role: Role;
}
