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

## Scripts

`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck. Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.
