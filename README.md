# Brighte Eats

Brighte Eats collects expressions of interest before launch (a public registration form) and shows them to Brighte staff in a leads dashboard. pnpm + Turborepo monorepo:

| Path          | Stack                                                    | Port (root `.env`) |
| ------------- | -------------------------------------------------------- | ------------------ |
| `apps/web`    | Next.js 16 (App Router), React 19, Tailwind 4 + SCSS      | 3001 (`WEB_PORT`) |
| `apps/api`    | NestJS 12, GraphQL (Apollo, code-first), Sequelize        | 4001 (`API_PORT`) |
| Storybook     | `apps/web` component library                             | 6006 (`STORYBOOK_PORT`) |
| Postgres 17   | `docker-compose.yml`                                      | 5435 (`POSTGRES_PORT`) |

**Contents:** [How to run](#how-to-run) · [Why I chose Postgres, NestJS and Next.js](#why-i-chose-postgres-nestjs-and-nextjs) · [Data modelling trade-offs](#data-modelling-trade-offs) · [Validation strategy](#validation-strategy--client-vs-server) · [Idempotency approach](#idempotency-approach) · [Frontend](#frontend) · [Leads API](#leads-api) · [Authentication](#authentication) · [Security](#security) · [Database migrations](#database-migrations) · [Testing](#testing) · [API collection (Bruno)](#api-collection-bruno) · [What I'd change at 10× scale](#what-id-change-at-10-scale) · [TODOs / known gaps](#todos--known-gaps) · [AI Assistance](#ai-assistance)

## How to run

Needs Node 24 (`.nvmrc`), pnpm 12 (`corepack enable`) and Docker.

```bash
pnpm install
cp .env.example .env                     # optional: only to change the ports above
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET (command in the file)
pnpm db:up        # Postgres in Docker
pnpm db:migrate   # apply pending migrations
pnpm db:seed      # dev accounts: admin@brighte.dev / user@brighte.dev
pnpm dev          # web + api in parallel
```

Then open:

| URL | What |
|---|---|
| http://localhost:3001/ | Registration form (public) |
| http://localhost:3001/admin | Leads dashboard: sign in as `admin@brighte.dev` / `admin-dev-password` (the seed passwords in `apps/api/.env`) |
| http://localhost:4001/graphql | GraphiQL (development only) |
| http://localhost:6006 | Storybook: `pnpm --filter @brighte/web storybook` |

Tests: `pnpm test` (unit and component), `pnpm test:e2e` (API and browser end-to-end; needs `pnpm db:up`, `db:migrate` and `db:seed`). See [Testing](#testing).

**Ports** live in one place, the root `.env` (see `.env.example`). Every script and tool reads it and falls back to the defaults above when a value (or the file) is missing: `pnpm dev`, `start`, `storybook`, Playwright, Lighthouse, Docker Compose, and the API's default CORS origin and the web app's API URL. A variable set in your shell still wins, e.g. `WEB_PORT=3002 pnpm dev`. Two exceptions: `DATABASE_URL` in `apps/api/.env` carries its own port, so change it together with `POSTGRES_PORT`; and an explicit `PORT` (set by hosting platforms and the smoke test) wins over `API_PORT`.

- API reference (static HTML): `pnpm --filter @brighte/api docs:build`, then open `apps/api/docs/index.html`. Every query and mutation must document its `**Auth:**` and `**Errors:**` in its schema description, and every error code it lists must appear in the error table in `apps/api/spectaql.yml`; `pnpm test` enforces both.
- Schema is generated to `apps/api/src/schema.gql` on API start.
- Postgres: `postgres://brighte:brighte@localhost:5435/brighte`.

## Why I chose Postgres, NestJS and Next.js

**PostgreSQL.** The data is relational: leads have many service interests, service types change, and duplicates must be impossible. Postgres gives foreign keys (a lead can't point at a service that doesn't exist), a unique constraint on email that holds under concurrent requests, and transactions, so a lead and its services are saved together or not at all. It's free, runs in one Docker container, and has a clear path for the id scheme (Postgres 18 adds `uuidv7()`).

**NestJS, Apollo (code-first) and Sequelize for the API.** TypeScript end to end. Code-first GraphQL keeps the schema, its types and the resolvers in one place; `schema.gql` is generated, never hand-edited, and every operation documents its auth rule and error codes (a test enforces it). Nest's guards give one place for the things every request needs: authentication (deny by default), roles, and rate limiting. Sequelize with Umzug migrations keeps schema changes as explicit, reviewable SQL steps with `synchronize` off. Prisma or Drizzle would fit as well; the migrations-first discipline matters more than the ORM.

**Next.js 16 (App Router) with React 19 for the web.** Server Components and Server Actions mean **the browser never calls the API**: pages and forms talk to the Next server, which calls the API. So the API URL and the admin's token stay on the server (the session is an httpOnly cookie), and the visitor's IP is forwarded for rate limits. Forms still work without JavaScript, because a Server Action is also a plain form POST. The dashboard's state (filter, page, selected lead) lives in the URL, so it needs no client JavaScript at all. Tailwind 4 with design tokens, and Storybook, for a small atomic-design component library.

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

**What the join table costs.** Writes touch two tables, so `register` must insert the lead and its services in one transaction. Reads need a join or a batched lookup; the API uses a per-request DataLoader, so listing leads with their services doesn't cause N+1 queries. Both costs are small at this scale.

**Indexes.** `leads(createdAt, id)` serves the default newest-first sort with a stable tie-breaker for offset pagination. `lead_service_types(serviceTypeId)` serves the filter by service type; the composite primary key already covers lookups by lead. The unique `leads.email` is what duplicate-lead (idempotency) handling relies on. Trigram (`pg_trgm`) GIN indexes on `leads.name` and `leads.email` serve the dashboard search, which matches anywhere in the text (`ILIKE '%term%'`), something a normal index can't do.

## Validation strategy — client vs server

**Both, with the server as the source of truth.**

- **Server (API).** Every input is parsed with a Zod schema (`apps/api/src/leads/leads.schemas.ts`) before any database work: name required and at most 70 characters, a valid email, an Australian mobile, a 4-digit postcode, at least one service. It also normalises: lowercase email, mobile stored as `04xxxxxxxx`, trimmed text, de-duplicated services. A failure returns `BAD_USER_INPUT` with `extensions.fields`, a map from each invalid field to a message. Whether a service code exists (and is still active) is only known to the database, so that check lives only on the server.
- **Browser (web).** `validateRegistration` and `validateSignIn` (`apps/web/src/lib`) repeat the same rules and messages, so mistakes show at once and **nothing is sent**, which also means typos never count against the API's rate limit. They're a convenience, not a security boundary: bots skip them, and without JavaScript the form relies on the server alone.
- **Showing server errors.** The web maps each API error code to plain copy (`apps/web/src/lib/api/*-feedback.ts`); it branches on `extensions.code`, never on messages. Field messages appear under their field, without repeating the example the field's hint already shows.
- **Trade-off:** the rules exist twice (Zod on the API, plain functions on the web), and only review keeps them in step. If they drift, the API still has the final word and its message is shown. A shared schema package would remove the duplication (see [TODOs](#todos--known-gaps)).

## Idempotency approach

`leads.email` is unique, and `register` relies on that constraint rather than a prior lookup, so two concurrent registrations with one email can't both succeed. The loser gets `CONFLICT` and nothing is changed. The form shows it on the email field: "This email has already registered interest. Use a different email."

`register` is public, so it deliberately doesn't merge into or return the existing lead: that would hand anyone who knows an email that person's stored name and mobile. The trade-off is that a retried request that already succeeded sees `CONFLICT`. Double submits from the form are also blocked in the browser while a submit is in flight.

## Frontend

| Route | What |
|---|---|
| `/` | Registration form. Service options come from the API (`serviceTypes`), so a new service appears without a deploy |
| `/admin/login` | Admin sign-in (`noindex`) |
| `/admin` | Leads dashboard: search as you type (name, email, mobile or postcode), filter by service, sortable columns (newest first by default), 10/20/50/100 per page, lead detail beside the list. State in the URL: `/admin?q=ada&service=delivery&sort=name_asc&size=50&page=2&lead=<id>` |
| anything else | Branded 404; failures show a branded "Something went wrong" page |

**How the web talks to the API.** Only through the Next server, via a server-only data access layer (`apps/web/src/lib/api`): `graphql()` adds the admin's token and the visitor's IP, times out after 10 seconds, and turns failures into an `ApiError` with the API's code. Admin pages and actions start with `requireAdmin()`, which asks the API (`me`) who the session belongs to; the cookie alone proves nothing. `apps/web/src/proxy.ts` renews an active admin's token when it has under 10 minutes left (a sliding session: 30 minutes idle, 8 hours at most; see [Authentication](#authentication)).

**When the API is slow or fails**, the UI says what happened and what to do, and keeps what was typed:

| Situation | What the user sees |
|---|---|
| Submitting (slow) | The button shows a spinner and "Submitting…", keeps keyboard focus, and ignores a second click or Enter; screen readers hear "Submitting your registration…" |
| Invalid input | Messages under each field, focus on the first (checked in the browser; the API's field messages if it disagrees) |
| Email already registered | A message on the email field |
| Rate limited | "Too many attempts" with a live countdown from the API's `retryAfter` (the API doubles the wait for repeat offenders) |
| Connection lost mid-submit | The form stays with everything typed, and "Check your connection and try again" with **Try again** |
| API down | Register: "We can't show the form right now" with Try again. Admin pages: the branded error page, with Try again |
| Admin session expired | Sign in again, then straight back to the same URL (search, filter, sort, page and lead kept) |
| Searching (slow) | Results follow the typing after a 300 ms pause, focus stays in the box, and letters typed while a search loads are kept; the lead count is announced to screen readers |

**Without JavaScript**, registering, signing in and out, and browsing the dashboard all work, because forms post to their Server Actions and the dashboard is links and GET forms (a Search and an Apply button appear only then).

**SEO and security headers.** The public page has a canonical URL, Open Graph and Twitter tags, JSON-LD structured data, `/robots.txt` and `/sitemap.xml` (Lighthouse SEO 100); admin pages are `noindex`. Every page sends a nonce-based Content-Security-Policy and other security headers (see [Security](#security)). Set `SITE_URL` (root `.env.example`) to the public address in production.

**Components** follow atomic design (`apps/web/src/components`: atoms, molecules, organisms, templates, enforced by ESLint), use design tokens from Brighte's palette, and meet WCAG 2.1 AA with **AAA text contrast**. Every component has Storybook stories, and every story is a test with an axe check. Conventions: `apps/web/CLAUDE.md`.

## Leads API

| Operation | What it does |
|---|---|
| `register(name, email, mobile, postcode, services)` | Records a lead and its service interests in one transaction. Returns the lead. |
| `leads(limit = 20, offset = 0, serviceType, search, sort = NEWEST_FIRST)` | One page of leads plus `total`. `limit` is 1–100. `search` (up to 100 characters): name or email containing it (any case), postcode starting with it, or mobile containing its digits; `%` and `_` match literally. `sort`: `NEWEST_FIRST`, `OLDEST_FIRST`, `NAME_ASC`/`DESC`, `EMAIL_ASC`/`DESC`, `POSTCODE_ASC`/`DESC`, each with `id` as tie-breaker so pages are stable. |
| `lead(id)` | One lead with its services, or `null`. |
| `serviceTypes` | Active service types, so the form is not hardcoded. |

- **Services are codes, not a GraphQL enum.** `register` checks each code against active `service_types` rows, so a new service works as soon as its row exists, with no schema change or deploy.
- **No N+1.** `Lead.services` goes through a per-request DataLoader: a page of leads costs one services query, whatever its size (an e2e test counts the queries).
- **Offset pagination** is what the spec asks for and suits a dashboard with page numbers. At scale, deep offsets get slow and rows shift between pages as leads arrive; keyset pagination on the existing `(createdAt, id)` index is the fix.

## Authentication

- `login(email, password)` returns `{ accessToken, user }`. The token is an HS256 JWT (`sub` = user id, `role`, `auth_time` = when they signed in) that expires after `JWT_EXPIRES_IN` (default `30m`); send it as `Authorization: Bearer <token>`.
- `renewToken` swaps a still-valid token for a fresh one with the same `auth_time`, re-reading the account (a new role applies; a deleted account is refused). It stops `SESSION_MAX_HOURS` (default `8`) after signing in, and a renewed token never lasts past that. So a session ends after `JWT_EXPIRES_IN` idle or `SESSION_MAX_HOURS` in total. The web app renews an admin's token from `apps/web/src/proxy.ts` when it has under 10 minutes left.
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

## Security

Public operations (`register`, `serviceTypes`, `login`) need no token, so they are hardened at several layers. Everything below is covered by `apps/api/test/security.e2e-spec.ts`.

| Threat | Protection |
|---|---|
| Spam registrations, password guessing, request floods | Rate limits per client IP and per operation (`@nestjs/throttler`): `register` 5/min, `login` 10/min, everything else 120/min, configurable with `RATE_LIMIT_*`. Over the limit: `TOO_MANY_REQUESTS` with `extensions.retryAfter` and a `Retry-After` header. **Backoff:** a client that goes over the same operation's limit again is blocked twice as long each time (60s, 120s, 240s… up to 15 minutes), back to 60s after 15 minutes without a block. Guards run per root field, so aliasing `register` 100 times in one request counts as 100. |
| Expensive or huge queries | Documents over 1000 tokens are rejected before parsing finishes (`GRAPHQL_PARSE_FAILED`); JSON bodies over 100kb get 413; batched requests are off. There is no depth limit because the schema has no recursive types; add one if that changes. |
| Other websites calling the API from a browser | CORS allows only the `WEB_ORIGIN` list (required in production), `GET`/`POST`, and the `Content-Type` and `Authorization` headers, without credentials, since auth is a bearer token rather than a cookie. Apollo's CSRF prevention rejects "simple" requests (e.g. `text/plain`) that skip the CORS preflight. Our own web app never calls the API from the browser (see [Frontend](#frontend)); CORS stays as defence in depth for any browser client. |
| Browser-side attacks on responses | API: `helmet` security headers (`nosniff`, HSTS, frame and referrer policies; CSP in production) and no `X-Powered-By`. Web: a **nonce-based Content-Security-Policy** set per request by `apps/web/src/proxy.ts` (scripts and styles only with that request's nonce, `frame-ancestors 'none'`, `object-src 'none'`, forms only to this site), plus `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` and no `X-Powered-By`; HSTS and `upgrade-insecure-requests` when `SITE_URL` is HTTPS. `apps/web/e2e/security.spec.ts` checks the headers and that the policy blocks nothing the app needs. |
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

## Database migrations

The schema is owned by [Umzug](https://github.com/sequelize/umzug) migrations in `apps/api/src/database/migrations/`. Sequelize `synchronize` is off, so changing a model does not change the database.

- Add a migration: create `apps/api/src/database/migrations/<YYYY.MM.DDTHH.mm.ss>.<description>.ts` exporting `up` and `down` (see the existing one). Files run in name order.
- `pnpm db:migrate`: apply pending migrations.
- `pnpm --filter @brighte/api db:migrate:status`: list pending migrations.
- `pnpm --filter @brighte/api db:migrate:undo`: revert the last migration.
- Production: run `node dist/database/migrate.js up` from `apps/api` after `nest build`, before starting the app.

## Testing

Tests are chosen to protect what would hurt most if it broke, not for coverage numbers.

| Layer | Command | What it covers |
|---|---|---|
| API unit | `pnpm --filter @brighte/api test` | Input schemas, error formatting, password hashing, rate-limit backoff, the API docs contract |
| API end-to-end | `pnpm --filter @brighte/api test:e2e` | Every operation against real Postgres (Supertest): register, leads, lead, auth, session renewal, access rules, security limits, N+1 query count |
| API smoke | `pnpm --filter @brighte/api test:smoke` | Builds and starts real servers (dev and production) and checks every operation, edge case and error code over HTTP |
| Web unit | `pnpm --filter @brighte/web test` | API client, error-to-copy mapping, validation, URL and session helpers |
| Component stories | same command | Every Storybook story renders in Chromium, runs its interaction test, and must pass axe (WCAG 2.1 AA) |
| Web end-to-end | `pnpm test:e2e` | Playwright on mobile and desktop, with axe: register, sign-in, dashboard (search, sort, page size), sessions, offline, slow submits, API down, 404, SEO files, security headers and CSP, and each flow without JavaScript |

The e2e suite starts its own production API and web servers (dev ports + 100, so it never touches a running dev setup), plus a web server whose API is unreachable. Each test sends its own visitor IP, so tests don't share rate limits. It needs Postgres migrated and seeded, and leaves its test leads in the dev database (useful data for trying the dashboard). Lighthouse: `pnpm --filter @brighte/web lighthouse` against a running production build. The public page must score 90+ for Performance and Best Practices, 95+ for Accessibility and 100 for SEO (it scores 100 in all four); admin pages are held to the same except SEO, since they are `noindex` on purpose.

The spec's suggested tests, and where they live:

| Suggested test | Where |
|---|---|
| A required field becoming optional | `apps/api/src/leads/leads.schemas.spec.ts` ("keeps every argument required") |
| A new service type added without the validation knowing | `apps/api/test/leads-api.e2e-spec.ts` ("accepts a service type added as data, with no code change, and refuses it once retired") |
| `register` returning a lead on the happy path | `apps/api/test/leads-api.e2e-spec.ts`, and the register flow in `apps/web/e2e/register.spec.ts` |
| The form showing an error when the API fails | `apps/web/e2e/register.spec.ts` (field errors, duplicate email, rate limit), `api-down.spec.ts`, `offline.spec.ts` |

## API collection (Bruno)

`apps/api/bruno/` is a [Bruno](https://www.usebruno.com) collection with every operation. It's plain-text files, so it is versioned and reviewed with the API.

1. Open the folder in Bruno (*Open Collection*), and `cp apps/api/bruno/.env.example apps/api/bruno/.env`. The passwords must match `SEED_*_PASSWORD` in `apps/api/.env`; the `.env` is gitignored.
2. Select the **local** environment and run **1 Auth / Login as admin**. It saves the access token, and every other request sends it as `Authorization: Bearer`. Tokens last 30 minutes (`JWT_EXPIRES_IN`): run **Renew token** to extend the session, or log in again when you get `UNAUTHENTICATED`.
3. **Register** saves the new lead's id, which **Get lead** uses. **4 Access checks** shows `FORBIDDEN`, `UNAUTHENTICATED` and `BAD_USER_INPUT`; it switches to the USER token, so log in as admin again afterwards.

Every request has a test, so the collection also runs from the command line: `cd apps/api/bruno && pnpm dlx @usebruno/cli run --env local -r` (add `--env-var baseUrl=http://localhost:<port>` for another port). Runs create a lead and a user with `bruno-…@example.com` emails in your dev database.

## Scripts

`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck (never bypassed with `--no-verify`). Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.

## What I'd change at 10× scale

- **Pagination.** Offset pages get slow when deep and shift as new leads arrive. Switch `leads` to keyset (cursor) pagination on the existing `(createdAt, id)` index, and stop computing an exact `total` on every page (cache it or show an estimate).
- **Rate limits across instances.** Counters and backoff are in memory, so each API instance counts separately. Move them to Redis, and absorb floods before Node with a CDN/WAF.
- **Sessions that can be revoked.** Tokens can't be cancelled before they expire (signing out only removes the cookie). Keep sessions or refresh tokens server-side (a table or Redis) so "sign out everywhere" and account lockout take effect at once.
- **Database.** A connection pooler (PgBouncer), and a read replica for the dashboard so reads don't compete with registrations.
- **Caching.** Service types change rarely but are fetched on every form load; cache them on the web server with a short revalidation.
- **One validation schema.** Share a single schema between the API and the web (a `packages/validation` workspace) instead of two copies.
- **Observability.** Structured logs, tracing across web → API → database (OpenTelemetry), and alerts on error rates and rate-limit spikes.
- **Search.** Trigram indexes serve substring search well into the millions of rows; beyond that, or for ranking and typo tolerance, move to Postgres full-text search or a search service.
- **Dashboard features.** CSV export, and an audit trail of service-interest changes.
- **Delivery.** CI running the full test suite on every pull request, against a dedicated test database, and deploying the API on a private network behind the web app.

## TODOs / known gaps

- **Validation rules are duplicated** between the API and the web (see [Validation strategy](#validation-strategy--client-vs-server)).
- **One manual setup step:** `JWT_SECRET` in `apps/api/.env` must be generated by hand (the command is in the file).
- **No CI configuration** in the repo yet; quality gates run in the pre-commit hook and locally.
- **Sign out doesn't revoke the token**, only removes the cookie (see 10× scale).
- **No admin user management UI**; admins are created with `createUser` (ADMIN only) or the dev seed.
- **Lighthouse can't sign in**, so `/admin` was measured by hand with a session cookie (100 for Performance, Accessibility and Best Practices).

## AI Assistance

I built this with Claude Code (Anthropic) as a pair: I set the plan and the constraints, reviewed every pull request, and asked for changes; the AI wrote most of the code, tests and documentation. The history shows it as small pull requests, each reviewed and merged by me.

- **Where AI helped:** API features (error handling, the leads data model and operations, security hardening, session renewal); the design tokens and components with their Storybook stories; the pages, Server Actions and session handling; end-to-end, component and smoke tests; this README.
- **Where I verified or changed its output:** I checked each feature in the browser and asked for changes, for example making all text meet AAA contrast, showing hints above errors, a client-side countdown with doubling backoff for rate limits, an account menu in the header, and keeping typed values when offline. Testing caught several of its mistakes: a form reset that broke the no-JavaScript path (found by e2e), an API that rejected `serviceType: null` (found while checking unfiltered dashboard URLs), a duplicated page shell, a skip link with no padding, and a flaky e2e race with session renewal.
- **Limitations:** Next.js 16 is newer than the model's training, so it had to read the bundled Next docs before using APIs such as `proxy.ts`, `retry()` and page metadata, and still made mistakes there (a doubled page title). Simulated events in component tests can't check CSS hover or native `<details>` toggling, so those moved to Playwright. It sometimes widened the scope of a change, which I kept in check in review.
