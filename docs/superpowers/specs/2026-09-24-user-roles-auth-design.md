# User roles and authentication (MVP)

Date: 2026-09-24
Status: implemented (PR 1 and PR 2)

## Goal

Seed a small set of users with different access levels (admin and normal user) and control which GraphQL operations each can call. Keep permission control easy to manage at MVP stage.

## Decisions

| Topic | Decision |
|---|---|
| Identity | Email + password login returns a JWT sent as `Authorization: Bearer <token>`. |
| Permission model | `role` column on `users` (`ADMIN`, `USER`). Endpoints declare allowed roles with `@Roles(...)`. |
| Default | Deny by default: every operation requires a valid token unless marked `@Public()`. |
| Sign-up | None. Accounts come from the seed script or from an admin. |
| Seeding | Dev-only `pnpm db:seed`, passwords from `.env`. |
| Prior art | `feat/api-auth-errors-validation` is a reference only; nothing is merged from it. |

Out of scope: web login UI, refresh tokens, password reset, rate limiting, runtime-editable roles or permission tables, error formatting and input-validation framework.

## Delivery

Two PRs, each merged before the next starts. Both build on the migrations setup (`feat/api-migrations`).

- **PR 1: data, login, seeding.** No access control yet.
- **PR 2: access control.** Global guard, role rules, web page change.

## PR 1: data, login, seeding

### Database

New migration `add-auth-to-users`:

- `role`: enum `enum_users_role` (`USER`, `ADMIN`), not null, default `USER`.
- `passwordHash`: `VARCHAR(255)`, not null.
- Column names are camelCase, matching the existing `createdAt`/`updatedAt`.
- `down` removes both columns and drops the enum type.

Because `passwordHash` is not null, the migration fails if `users` already has rows. Existing dev rows are test data and are deleted before running it.

### User model

- `role` is a GraphQL field of enum type `Role`.
- `passwordHash` is a model column but never a GraphQL field. A default scope excludes it from queries; a `withPassword` scope includes it for login only.

### Passwords (`src/auth/password.ts`)

- `hashPassword(plain)`: `scrypt` from `node:crypto` with a random 16-byte salt; stored as `scrypt$<salt>$<hash>` (base64).
- `verifyPassword(plain, stored)`: recomputes and compares with `timingSafeEqual`. Returns `false` for a malformed stored value.
- No native dependencies.

### Login

- `login(email: String!, password: String!): AuthPayload!`, where `AuthPayload = { accessToken: String!, user: User! }`.
- Email is matched case-insensitively (stored lowercase).
- An unknown email and a wrong password both fail with the same error, `Invalid email or password`. For an unknown email, a dummy hash is verified so response time does not reveal whether the account exists.
- Token: HS256 JWT signed with `JWT_SECRET`, expiry `JWT_EXPIRES_IN` (default `15m`). Payload: `{ sub: <user id>, role: <role> }`.
- The role is taken from the token, so a role change applies at the user's next login (at most `JWT_EXPIRES_IN` later).
- Adds the `@nestjs/jwt` dependency. `JWT_SECRET` and `JWT_EXPIRES_IN` are added to `.env.example`. The API refuses to start if `JWT_SECRET` is missing or shorter than 32 characters.

### Existing operations during PR 1

There is no guard yet, so `users` and `createUser` stay public, as on `main` today.

- `createUser(input: { email, name, password })` requires a password of at least 8 characters, stores its hash, and **always creates a `USER`**. It does not accept `role`, so a public caller cannot create an admin.
- `users` returns `role` but never `passwordHash`.

### Seeding

- `pnpm db:seed` (root) runs `apps/api/src/database/seed.ts`, in the same style as `migrate.ts`: Node type stripping in dev, compiled `.js` from `dist`.
- Creates or updates, matched by email:
  - `admin@brighte.dev`, name `Admin`, role `ADMIN`, password `SEED_ADMIN_PASSWORD`
  - `user@brighte.dev`, name `User`, role `USER`, password `SEED_USER_PASSWORD`
- Exits with an error if `NODE_ENV=production`, or if either password variable is missing or shorter than 8 characters.
- Re-running updates name, role and password; it never duplicates.
- `.env.example` gets example values for both variables.

### Testing (PR 1)

- Unit (`password.spec.ts`): hash then verify succeeds; wrong password fails; two hashes of the same password differ; malformed stored value returns `false`.
- API e2e (`auth.e2e-spec.ts`, real database, test users with a unique email prefix removed afterwards):
  - Login with correct credentials returns a token that verifies with `JWT_SECRET` (HS256), with `sub` equal to the user id, `role` equal to the user's role, and `exp - iat` equal to `JWT_EXPIRES_IN`.
  - Login email is case-insensitive.
  - Wrong password and unknown email return the same error message.
  - A token signed with a different secret fails verification; an expired token fails verification.
  - `createUser` stores a hash (not the plain password), always sets role `USER`, and rejects passwords shorter than 8 characters.
  - `passwordHash` is not in the GraphQL schema.
- Manual: `pnpm db:migrate && pnpm db:seed`, run the seed twice (no duplicates), log in as each seeded user with curl and decode the token; web page still returns 200.
- Gates: `pnpm lint && pnpm lint:style && pnpm typecheck && pnpm test`, plus the API e2e suite.

## PR 2: access control

### Guard

Global guard (`APP_GUARD`) in `src/auth/`, applied to GraphQL and REST:

1. Handler or class marked `@Public()`: allow.
2. Otherwise require a valid bearer token. Missing, malformed, bad-signature or expired token: **401**, GraphQL code `UNAUTHENTICATED`.
3. Handler or class marked `@Roles(...)`: the token's role must be listed, otherwise **403**, GraphQL code `FORBIDDEN`.

`@CurrentUser()` provides `{ id, role }` from the token.

### Rules

| Operation | Access |
|---|---|
| `login` | public |
| `me` (new) | ADMIN, USER |
| `users` | ADMIN |
| `createUser(input: { email, name, password, role = USER })` | ADMIN; gains the optional `role` field |
| `GET /` (REST) | public (Playwright readiness check) |

### Web

The home page stops listing users (anonymous calls to `users` would fail) and stays a static scaffold: heading and stack line. Web login is a later, separate piece of work.

### Testing (PR 2)

- API e2e: no token gives 401; bad token gives 401; USER can call `me`, gets 403 on `users` and `createUser`; ADMIN can call all three; ADMIN can create an ADMIN; the created user can log in; `GET /` works without a token.
- Web Playwright + axe suite passes with the static page.
- Same quality gates as PR 1.
