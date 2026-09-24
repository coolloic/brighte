# Brighte

pnpm + Turborepo monorepo.

| Path          | Stack                                                    | Port |
| ------------- | -------------------------------------------------------- | ---- |
| `apps/web`    | Next.js 16 (App Router), React 19, Tailwind 4 + SCSS      | 3001 |
| `apps/api`    | NestJS 12, GraphQL (Apollo, code-first), Sequelize        | 4001 |
| `packages/*`  | Shared packages (empty)                                   |      |
| Postgres 17   | `docker-compose.yml`                                      | 5435 |

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET (command in the file)
cp apps/web/.env.example apps/web/.env.local
pnpm db:up        # Postgres in Docker (override host port with POSTGRES_PORT)
pnpm db:migrate   # apply pending migrations
pnpm db:seed      # dev accounts: admin@brighte.dev / user@brighte.dev
pnpm dev          # web + api in parallel
```

- GraphQL playground (GraphiQL, interactive): http://localhost:4001/graphql
- API reference (static HTML): `pnpm --filter @brighte/api docs:build`, then open `apps/api/docs/index.html`. Every query and mutation must document its `**Auth:**` and `**Errors:**` in its schema description, and every error code it lists must appear in the error table in `apps/api/spectaql.yml`; `pnpm test` enforces both.
- Schema is generated to `apps/api/src/schema.gql` on API start.
- Postgres: `postgres://brighte:brighte@localhost:5435/brighte`.

## Authentication

- `login(email, password)` returns `{ accessToken, user }`. The token is an HS256 JWT (`sub` = user id, `role`) that expires after `JWT_EXPIRES_IN` (default `15m`); send it as `Authorization: Bearer <token>`.
- Deny by default: every GraphQL operation and REST route needs a valid token unless marked `@Public()`. Missing, invalid or expired token: `UNAUTHENTICATED` (401). Add `@Roles(Role.ADMIN, ...)` to restrict by role; a caller without a listed role gets `FORBIDDEN` (403). Design: `docs/superpowers/specs/2026-09-24-user-roles-auth-design.md`.

| Operation | Access |
|---|---|
| `login` | public |
| `me` | ADMIN, USER |
| `users` | ADMIN |
| `createUser` (optional `role`, default `USER`) | ADMIN |
| `GET /` | public |

- `pnpm db:seed` (dev only) creates or updates `admin@brighte.dev` (ADMIN) and `user@brighte.dev` (USER) with passwords from `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` in `apps/api/.env`.
- The API refuses to start if `JWT_SECRET` is missing or shorter than 32 characters.

## Database migrations

The schema is owned by [Umzug](https://github.com/sequelize/umzug) migrations in `apps/api/src/database/migrations/`. Sequelize `synchronize` is off, so changing a model does not change the database.

- Add a migration: create `apps/api/src/database/migrations/<YYYY.MM.DDTHH.mm.ss>.<description>.ts` exporting `up` and `down` (see the existing one). Files run in name order.
- `pnpm db:migrate`: apply pending migrations.
- `pnpm --filter @brighte/api db:migrate:status`: list pending migrations.
- `pnpm --filter @brighte/api db:migrate:undo`: revert the last migration.
- Production: run `node dist/database/migrate.js up` from `apps/api` after `nest build`, before starting the app.

## Data modelling trade-offs

Brighte Eats leads can be interested in several services, and the service types "may change over time". Three tables (migration `2026.09.25T00.00.00.create-leads.ts`):

| Table | Purpose |
|---|---|
| `service_types` | One row per service: stable `code` (`delivery`, `pick-up`, `payment`), display `label`, `active` flag |
| `leads` | Name, email (unique, stored lowercase), mobile, postcode |
| `lead_service_types` | Join table, primary key `(leadId, serviceTypeId)` |

**Lead ids are UUID v7.** `register` is public and returns the lead, so a sequential id would reveal how many people have signed up (register twice, subtract). UUID v7 can't be guessed and doesn't reveal volume. It's also time-ordered, so inserts append to the primary-key index like a serial id; random UUID v4 values land anywhere in the index and slow writes as the table grows. Postgres 17 has no `uuidv7()`, so the `Lead` model generates the id (`uuid` package) and the column has no default: raw SQL inserts must supply one. Postgres 18 adds `uuidv7()`, which could become the column default. `service_types` keeps integer ids: it's internal reference data, and the API identifies types by `code`.

**Why a join table, not an enum.** A Postgres enum (or a TypeScript enum checked by the API) makes the list of services part of the schema and the code. Adding a type means a migration and a deploy. Removing or renaming a value is worse: Postgres can't drop an enum value, so the type has to be rebuilt and every row rewritten. With a table, a new service is an `INSERT`, and a retired one is `active = false`. Existing leads keep their history, and a foreign key with `ON DELETE RESTRICT` stops a type in use from being deleted. An enum also has nowhere to keep a label or an active flag.

**Why not JSON.** A `services` JSON/array column on `leads` is the quickest thing to write, but the database can't protect it. Nothing stops `["delivry"]`, duplicates, or a code that was never a service, because there's no foreign key into a JSON value. Renaming a service means rewriting every lead's JSON. The dashboard filter "leads interested in X" becomes a JSON containment query that needs a GIN index, and counting leads per service needs `jsonb_array_elements`. With the join table, it's a plain indexed join.

**What the join table costs.** Writes touch two tables, so `register` must insert the lead and its services in one transaction. Reads need a join or a batched lookup; the API will use a DataLoader to avoid N+1 when listing leads with their services. Both costs are small at this scale.

**Indexes.** `leads(createdAt, id)` serves the default newest-first sort with a stable tie-breaker for offset pagination. `lead_service_types(serviceTypeId)` serves the filter by service type; the composite primary key already covers lookups by lead. The unique `leads.email` is what the API's duplicate-lead (idempotency) handling will rely on.

## Scripts

`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck. Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.
