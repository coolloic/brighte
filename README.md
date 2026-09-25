# Brighte

pnpm + Turborepo monorepo.

| Path          | Stack                                                    | Port (root `.env`) |
| ------------- | -------------------------------------------------------- | ------------------ |
| `apps/web`    | Next.js 16 (App Router), React 19, Tailwind 4 + SCSS      | 3001 (`WEB_PORT`) |
| `apps/api`    | NestJS 12, GraphQL (Apollo, code-first), Sequelize        | 4001 (`API_PORT`) |
| Storybook     | `apps/web` component library                             | 6006 (`STORYBOOK_PORT`) |
| `packages/*`  | Shared packages (empty)                                   |      |
| Postgres 17   | `docker-compose.yml`                                      | 5435 (`POSTGRES_PORT`) |

## Getting started

```bash
pnpm install
cp .env.example .env                     # optional: only to change the ports above
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET (command in the file)
pnpm db:up        # Postgres in Docker
pnpm db:migrate   # apply pending migrations
pnpm db:seed      # dev accounts: admin@brighte.dev / user@brighte.dev
pnpm dev          # web + api in parallel
```

**Ports** live in one place, the root `.env` (see `.env.example`). Every script and tool reads it and falls back to the defaults above when a value (or the file) is missing: `pnpm dev`, `start`, `storybook`, Playwright, Lighthouse, Docker Compose, and the API's default CORS origin and the web app's API URL. A variable set in your shell still wins, e.g. `WEB_PORT=3002 pnpm dev`. Two exceptions: `DATABASE_URL` in `apps/api/.env` carries its own port, so change it together with `POSTGRES_PORT`; and an explicit `PORT` (set by hosting platforms and the smoke test) wins over `API_PORT`.

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
| `register`, `serviceTypes` | public |
| `leads`, `lead` | ADMIN |
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

## Leads API

| Operation | What it does |
|---|---|
| `register(name, email, mobile, postcode, services)` | Records a lead and its service interests in one transaction. Returns the lead. |
| `leads(limit = 20, offset = 0, serviceType, sort = NEWEST_FIRST)` | One page of leads plus `total`. `limit` is 1–100. `sort`: `NEWEST_FIRST`, `OLDEST_FIRST`, `NAME_ASC`, each with `id` as tie-breaker so pages are stable. |
| `lead(id)` | One lead with its services, or `null`. |
| `serviceTypes` | Active service types, so the form is not hardcoded. |

- **Services are codes, not a GraphQL enum.** `register` checks each code against active `service_types` rows, so a new service works as soon as its row exists, with no schema change or deploy.
- **No N+1.** `Lead.services` goes through a per-request DataLoader: a page of leads costs one services query, whatever its size (an e2e test counts the queries).
- **Offset pagination** is what the spec asks for and suits a dashboard with page numbers. At scale, deep offsets get slow and rows shift between pages as leads arrive; keyset pagination on the existing `(createdAt, id)` index is the fix.

### Validation strategy: client vs server

The server is the source of truth: every input is parsed with a Zod schema (`apps/api/src/leads/leads.schemas.ts`) before any database work, and it also normalises (lowercase email, mobile as `04xxxxxxxx`, trimmed text, de-duplicated services). A failure returns `BAD_USER_INPUT` with `extensions.fields`, a map from each invalid field to a message the form can show beside it. The form should repeat the same rules for instant feedback, but never instead of the server. Whether a service code exists is only known to the database, so that check lives only on the server.

### Idempotency approach

`leads.email` is unique, and `register` relies on that constraint rather than a prior lookup, so two concurrent registrations with one email cannot both succeed. The loser gets `CONFLICT` ("Email is already registered") and nothing is changed. `register` is public, so it deliberately does not merge into or return the existing lead: that would hand anyone who knows an email that person's stored name and mobile. The trade-off is that a retried request that already succeeded sees `CONFLICT`, which the form can present as "you're already registered".

## Security

Public operations (`register`, `serviceTypes`, `login`) need no token, so they are hardened at several layers. Everything below is covered by `apps/api/test/security.e2e-spec.ts`.

| Threat | Protection |
|---|---|
| Spam registrations, password guessing, request floods | Rate limits per client IP and per operation (`@nestjs/throttler`): `register` 5/min, `login` 10/min, everything else 120/min, configurable with `RATE_LIMIT_*`. Over the limit: `TOO_MANY_REQUESTS` with `extensions.retryAfter` and a `Retry-After` header. Guards run per root field, so aliasing `register` 100 times in one request counts as 100. |
| Expensive or huge queries | Documents over 1000 tokens are rejected before parsing finishes (`GRAPHQL_PARSE_FAILED`); JSON bodies over 100kb get 413; batched requests are off. There is no depth limit because the schema has no recursive types; add one if that changes. |
| Other websites calling the API from a browser | CORS allows only the `WEB_ORIGIN` list (required in production), `GET`/`POST`, and the `Content-Type` and `Authorization` headers, without credentials, since auth is a bearer token rather than a cookie. Apollo's CSRF prevention rejects "simple" requests (e.g. `text/plain`) that skip the CORS preflight. |
| Browser-side attacks on responses | `helmet` security headers (`nosniff`, HSTS, frame and referrer policies; CSP in production) and no `X-Powered-By`. |
| Schema discovery | Introspection and GraphiQL are off when `NODE_ENV=production` (Apollo and Nest defaults). |
| Leaking internals | Unexpected errors are logged and returned as `Internal server error` (see `formatError`). |
| Injection | All database access goes through Sequelize with bound parameters; inputs are validated with Zod first. |

**Behind a proxy**, set `TRUST_PROXY` to the number of hops so the limiter sees the client's IP. Otherwise every client shares the proxy's IP and one noisy client throttles everyone.

**The web app is such a proxy.** The browser never calls the API: pages and Server Actions call it from the Next server (`apps/web/src/lib/api`), which keeps the API URL and admin tokens off the client. So in production:

- Run the API with `TRUST_PROXY=1` and make it reachable **only** from the web server (private network). Otherwise anyone could call it directly with a made-up `X-Forwarded-For`.
- Set `WEB_TRUST_PROXY` on the web app to the number of proxies in front of **it** (e.g. `1` behind a load balancer). The web app reads the visitor's IP from those proxies' `X-Forwarded-For` entries and forwards just that IP to the API; entries a client wrote itself are ignored. Unset (local development), nothing is forwarded.
- `API_URL` points the web app at the API (default `http://localhost:${API_PORT}/graphql`).

Without this, every visitor shares the web server's IP, and five registrations a minute would be the limit for everyone.

**What this does not cover.** App-level rate limiting slows abuse; it does not stop a real DDoS, which has to be absorbed before it reaches Node (a CDN or WAF, e.g. Cloudflare or AWS WAF, plus load balancer limits). Counters are in memory, so each instance counts separately; with several instances, move them to Redis (`@nest-lab/throttler-storage-redis`). A distributed password-guessing attack spreads across IPs, so per-account lockout or a CAPTCHA on repeated failures would be the next step, and a CAPTCHA (e.g. Turnstile) on `register` if bots get past the per-IP limit. Oversized bodies (413) are still logged at ERROR with a stack, which is noisy under attack.

## API collection (Bruno)

`apps/api/bruno/` is a [Bruno](https://www.usebruno.com) collection with every operation. It's plain-text files, so it is versioned and reviewed with the API.

1. Open the folder in Bruno (*Open Collection*), and `cp apps/api/bruno/.env.example apps/api/bruno/.env`. The passwords must match `SEED_*_PASSWORD` in `apps/api/.env`; the `.env` is gitignored.
2. Select the **local** environment and run **1 Auth / Login as admin**. It saves the access token, and every other request sends it as `Authorization: Bearer`. Tokens expire after 15 minutes: run it again when you get `UNAUTHENTICATED`.
3. **Register** saves the new lead's id, which **Get lead** uses. **4 Access checks** shows `FORBIDDEN`, `UNAUTHENTICATED` and `BAD_USER_INPUT`; it switches to the USER token, so log in as admin again afterwards.

Every request has a test, so the collection also runs from the command line: `cd apps/api/bruno && pnpm dlx @usebruno/cli run --env local -r` (add `--env-var baseUrl=http://localhost:<port>` for another port). Runs create a lead and a user with `bruno-…@example.com` emails in your dev database.

## Storybook (web components)

`pnpm --filter @brighte/web storybook` opens the component library at http://localhost:6006; `pnpm --filter @brighte/web build-storybook` builds it to `apps/web/storybook-static/`. Every story is also a test: `pnpm --filter @brighte/web test` (part of `pnpm test`) renders each one in headless Chromium, runs its `play` function and fails on any WCAG 2.1 AA violation. Conventions are in the **Introduction** page and `apps/web/CLAUDE.md`.

## Scripts

**API smoke test:** `pnpm --filter @brighte/api test:smoke` builds the API, starts real servers (dev, dev with the real rate limits, production) on ports 4801-4804 (`SMOKE_PORT` to move them), and checks every operation, edge case and error code over HTTP, the way the web app calls it. It needs Postgres migrated and seeded (`pnpm db:up && pnpm db:migrate && pnpm db:seed`), cleans up its data, and exits non-zero on any failure.


`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck. Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.
