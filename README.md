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
pnpm dev          # web + api in parallel
```

- GraphQL playground: http://localhost:4001/graphql
- Schema is generated to `apps/api/src/schema.gql` on API start.
- Sequelize `synchronize` is on outside production — add migrations before shipping.

## Scripts

`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck. Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.
