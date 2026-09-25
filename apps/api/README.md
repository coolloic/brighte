# @brighte/api

The Brighte Eats GraphQL API: `register`, `leads`, `lead`, `serviceTypes`, plus authentication (`login`, `renewToken`, `me`) and user management. NestJS 12, Apollo (code-first), Sequelize on Postgres 17.

Setup, scripts and design notes are in the [root README](../../README.md), in particular [Leads API](../../README.md#leads-api), [Authentication](../../README.md#authentication), [Security](../../README.md#security) and [Database migrations](../../README.md#database-migrations). Configuration: [`.env.example`](./.env.example). A [Bruno](https://www.usebruno.com) collection of every operation is in [`bruno/`](./bruno).

```bash
pnpm --filter @brighte/api dev          # http://localhost:4001/graphql (API_PORT)
pnpm --filter @brighte/api test         # unit tests
pnpm --filter @brighte/api test:e2e     # against real Postgres
pnpm --filter @brighte/api test:smoke   # real servers over HTTP
pnpm --filter @brighte/api db:migrate   # apply migrations
```
