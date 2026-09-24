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
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up        # Postgres in Docker (override host port with POSTGRES_PORT)
pnpm db:migrate   # apply pending migrations
pnpm dev          # web + api in parallel
```

- GraphQL playground: http://localhost:4001/graphql
- Schema is generated to `apps/api/src/schema.gql` on API start.
- Postgres: `postgres://brighte:brighte@localhost:5435/brighte`.

## Database migrations

The schema is owned by [Umzug](https://github.com/sequelize/umzug) migrations in `apps/api/src/database/migrations/`. Sequelize `synchronize` is off, so changing a model does not change the database.

- Add a migration: create `apps/api/src/database/migrations/<YYYY.MM.DDTHH.mm.ss>.<description>.ts` exporting `up` and `down` (see the existing one). Files run in name order.
- `pnpm db:migrate`: apply pending migrations.
- `pnpm --filter @brighte/api db:migrate:status`: list pending migrations.
- `pnpm --filter @brighte/api db:migrate:undo`: revert the last migration.
- Production: run `node dist/database/migrate.js up` from `apps/api` after `nest build`, before starting the app.

## Scripts

`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck. Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.
