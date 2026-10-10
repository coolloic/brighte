# CV coach

CV coach is a chat that helps you apply for a job without making anything up. Attach your CV and a job ad, and it reads the CV into a structured profile, shows how well it matches the job, tailors the CV to it and writes a cover letter, each checked against what your CV actually says. The CV, tailored CV and cover letter download as polished PDFs. An admin area (sign-in and a leads dashboard) stays from the project's first brief, Brighte Eats (see [Project history](#project-history)).

pnpm + Turborepo monorepo:

| Path          | Stack                                                    | Port (root `.env`) |
| ------------- | -------------------------------------------------------- | ------------------ |
| `apps/web`    | Next.js 16 (App Router), React 19, Tailwind 4 + SCSS      | 3001 (`WEB_PORT`) |
| `apps/api`    | NestJS 12, GraphQL (Apollo, code-first), Sequelize        | 4001 (`API_PORT`) |
| Storybook     | `apps/web` component library                             | 6006 (`STORYBOOK_PORT`) |
| Postgres 17   | `docker-compose.yml`                                      | 5435 (`POSTGRES_PORT`) |

**Contents:** [How to run](#how-to-run) · [The CV coach chat](#the-cv-coach-chat) · [Frontend](#frontend) · [Why I chose Postgres, NestJS and Next.js](#why-i-chose-postgres-nestjs-and-nextjs) · [Project history](#project-history) · [Data modelling trade-offs](#data-modelling-trade-offs) · [Validation strategy](#validation-strategy--client-vs-server) · [Leads API](#leads-api) · [Authentication](#authentication) · [Security](#security) · [Observability](#observability-api) · [Database migrations](#database-migrations) · [Testing](#testing) · [API collection (Bruno)](#api-collection-bruno) · [What I'd change at 10× scale](#what-id-change-at-10-scale) · [TODOs / known gaps](#todos--known-gaps) · [AI Assistance](#ai-assistance)

**Diagrams:** [docs/architecture.md](docs/architecture.md): the [database ER diagram](docs/architecture.md#database-er-diagram), the [system architecture](docs/architecture.md#system-architecture) and the [main request flows](docs/architecture.md#request-flows) (Mermaid, rendered by GitHub). They and the [slides](docs/slides/index.html) describe the Brighte Eats version.

## How to run

Needs Node 24 (`.nvmrc`), pnpm 12 (`corepack enable`), Docker, and an API key for at least one LLM provider (Anthropic, OpenAI or Gemini).

```bash
pnpm install
pnpm bootstrap    # env files, Postgres in Docker, migrations, dev accounts and sample leads
# add your key to the root .env:  ANTHROPIC_API_KEY=sk-ant-...
pnpm dev          # web + api in parallel
```

`pnpm bootstrap` is safe to run again. It creates `.env` (ports and chat settings) and `apps/api/.env` from their examples with a random `JWT_SECRET`, keeping any file that already exists (only an empty `JWT_SECRET` is filled in), then runs `pnpm db:up` (Postgres in Docker, waits until it's ready), `pnpm db:migrate` and `pnpm db:seed` (dev accounts `admin@brighte.dev` / `user@brighte.dev`, and 150 sample leads; see [Authentication](#authentication)). For other ports, copy `.env.example` to `.env` and edit it before the first run: `apps/api/.env` takes its database port from it.

The web server reads the root `.env` when it starts: restart `pnpm dev` after changing it. Without any provider key, the home page says "The chat isn't available right now".

Then open:

| URL | What |
|---|---|
| http://localhost:3001/ | The CV coach chat (public). `/chat` redirects here |
| http://localhost:3001/admin | Admin: leads dashboard. Sign in as `admin@brighte.dev` / `admin-dev-password` (the seed passwords in `apps/api/.env`) |
| http://localhost:4001/graphql | GraphiQL (development only) |
| http://localhost:6006 | Storybook: `pnpm storybook` |

Tests: `pnpm test` (unit and component), `pnpm test:e2e` (API and browser end-to-end; needs `pnpm bootstrap` first, but no provider key: the chat tests use a mock model). See [Testing](#testing).

**Ports** live in one place, the root `.env` (see `.env.example`). Every script and tool reads it and falls back to the defaults above when a value (or the file) is missing: `pnpm dev`, `start`, `storybook`, Playwright, Lighthouse, Docker Compose, and the API's default CORS origin and the web app's API URL. A variable set in your shell still wins, e.g. `WEB_PORT=3002 pnpm dev`. Two exceptions: `DATABASE_URL` in `apps/api/.env` carries its own port, so change it together with `POSTGRES_PORT`; and an explicit `PORT` (set by hosting platforms and the smoke test) wins over `API_PORT`.

- API reference (static HTML): `pnpm --filter @brighte/api docs:build`, then open `apps/api/docs/index.html`. Every query and mutation must document its `**Auth:**` and `**Errors:**` in its schema description, and every error code it lists must appear in the error table in `apps/api/spectaql.yml`; `pnpm test` enforces both.
- Schema is generated to `apps/api/src/schema.gql` on API start.
- Postgres: `postgres://brighte:brighte@localhost:5435/brighte`.

## The CV coach chat

**What it does.** Attach files (images, PDF, or `.txt`, `.md`, `.csv`, `.json`) or paste text, and ask. Suggested starts: *Read my CV into a profile*, *How well does my CV match this job?*, *Tailor my CV for this job*, *Write a cover letter for this job*.

| You ask | You get |
|---|---|
| Read my CV | **Profile**: your CV as structured data (contact, roles, projects, education, skills…), copied, not reworded. Correct it in plain words ("my Globex role ended in 2020") and a new version replaces it. **Save profile** downloads it as JSON; attach that file in a later chat to carry on |
| How well does it match | **Match report**: a score, and each requirement of the job ad as met, partial or missing, with the evidence from your CV and an honest next step |
| Tailor my CV | **Tailored CV**: your roles, bullets and skills reordered and reworded for the job, with what was left out and each reworded bullet beside its original |
| Write a cover letter | **Cover letter**: 3 to 5 paragraphs for the job, with your name and contact details from the profile |

The profile, tailored CV and cover letter each have **Preview PDF** and **Download PDF**: one clean, single-column, ATS-friendly template with real text (e.g. `Jane-Citizen-CV-Brightpath.pdf`, `Jane-Citizen-Cover-Letter-Brightpath.pdf`).

**Never inventing** is the rule the design is built around:

- The model answers in fenced JSON blocks (` ```profile `, ` ```match `, ` ```tailored `, ` ```coverletter `) that follow Zod schemas (`apps/web/src/lib/chat/*-block.ts`); the system prompt includes each schema's JSON Schema. The page shows each block as a card, a placeholder while it streams, and says so when one is cut off.
- A **tailored CV** doesn't restate facts. It refers to the profile by index ("role 0, bullets 1 and 2") and only adds new wording; `tailorCv` takes employers, titles and dates from the profile. A bullet with no source in the profile, or a skill the profile doesn't have, is flagged, and a CV with blocking flags can't be downloaded until the coach fixes it.
- A **cover letter** holds only the letter. Your name, email and phone come from the profile, so the model can't get them wrong. Its claims must come from the profile (a prompt rule: unlike the tailored CV, prose can't be checked mechanically).
- **PDFs are made on the server** (`POST /api/cv-pdf`, `@react-pdf/renderer`), which checks again what the page sends: both schemas, and for a tailored CV `tailorCv` on that pair.

**How it works.** The page sends the conversation (the last 20 turns, with their files) to `POST /api/chat` on the Next server, which streams the provider's reply back as plain text. The conversation lives only in the browser tab: nothing is stored on the server. Models are discovered from each configured provider's models API and filtered by `CHAT_MODELS` (the cheap tier of each by default); visitors pick one under the message box.

**Settings** (root `.env`, read when the web server starts; see `.env.example`):

| Variable | Default | What |
|---|---|---|
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | none | A provider is on when its key is set |
| `CHAT_MODELS` | the cheap tier of each provider | Which models visitors may pick: `provider:model` globs, `!` excludes |
| `CHAT_DEFAULT_MODEL` | `anthropic:claude-haiku-4-5` | The picker's starting model |
| `CHAT_PERSONA` | `career` (CV coach) | Who answers: `career`, `general` (no topic limits) or `brighte` (the Brighte Eats assistant) |
| `CHAT_MAX_MESSAGE_CHARS` / `CHAT_MAX_OUTPUT_TOKENS` | the persona's: 8000 / 8192 | Longest message, and longest reply. Thinking counts toward the reply; a profile or tailored CV for a long CV needs a high cap. The provider's own maximum applies (64,000 for Claude Haiku 4.5) |
| `CHAT_EFFORT` | `low` | How much models think, where they support it |
| `CHAT_MAX_FILES` / `CHAT_MAX_FILE_MB` / `CHAT_MAX_REQUEST_MB` | 3 / 5 / 10 | Files per message, size of each, all files in one request. Anthropic caps a request at 32 MB (files grow by a third as base64) and an image at 5 MB |
| `CHAT_RATE_LIMIT` / `CHAT_RATE_LIMIT_WINDOW_SECONDS` | 20 / 600 | Messages per visitor (IP) per window |
| `CHAT_PDF_RATE_LIMIT` | 30 | PDFs per visitor per window |

**Protections.** Provider keys never reach the browser. Every message costs money, so each visitor is rate limited (in memory, per web server), the request body is read only up to its limit, and the server re-checks every message and file (type sniffed from its content, not its name) against the same limits as the page. Provider errors are logged on the server and shown as plain words, never their details. PDFs: JSON only (415 otherwise), at most 256 KB, characters the PDF font lacks are named and refused rather than printed as gaps.

Design notes for each step are in `docs/superpowers/specs/2026-10-05-chat-*.md`.

## Frontend

| Route | What |
|---|---|
| `/` | The CV coach chat. `/chat` permanently redirects here |
| `/admin/login` | Admin sign-in (`noindex`) |
| `/admin` | Leads dashboard: search as you type (name, email, mobile or postcode), filter by service, sortable columns (newest first by default), 10/20/50/100 per page, lead detail beside the list (closed with its × to give the list its full width back). State in the URL: `/admin?q=ada&service=delivery&sort=name_asc&size=50&page=2&lead=<id>` |
| `/api/chat`, `/api/cv-pdf` | The chat's route handlers (see [The CV coach chat](#the-cv-coach-chat)) |
| anything else | Branded 404; failures show a branded "Something went wrong" page |

**How the web talks to the API** ([architecture diagram and request flows](docs/architecture.md#system-architecture)). Only the admin pages use the API, and only through the Next server, via a server-only data access layer (`apps/web/src/lib/api`): `graphql()` adds the admin's token and the visitor's IP, times out after 10 seconds, and turns failures into an `ApiError` with the API's code. Admin pages and actions start with `requireAdmin()`, which asks the API (`me`) who the session belongs to; the cookie alone proves nothing. `apps/web/src/proxy.ts` renews an active admin's token when it has under 10 minutes left (a sliding session: 30 minutes idle, 8 hours at most; see [Authentication](#authentication)). The chat doesn't use the API, so it keeps working while the API is down.

**Service types are cached for 5 minutes** on each web server (`cachedFor` in `apps/web/src/lib/cached-for.ts`), so the dashboard's filter doesn't ask the API on every render. Set `SERVICE_TYPES_CACHE_SECONDS` in the root `.env` to change it (`0` turns the cache off). Failures aren't cached: the next render asks again.

**When something is slow or fails**, the UI says what happened and what to do, and keeps what was typed:

| Situation | What the user sees |
|---|---|
| A reply streaming in | It appears as it arrives; **Stop** keeps what arrived. Cards show a placeholder until their block is complete |
| A reply fails or is cut off | "The assistant couldn't answer just now" (or "The reply was cut off") with **Try again**; the message stays |
| A card's block is cut off (length cap) | "This profile couldn't be shown. It may have been cut off: ask me to try again." |
| Too many messages or PDFs | How many minutes to wait |
| No provider configured, or every models API failed | "The chat isn't available right now" with Try again |
| Signing in (slow) | The button shows a spinner and "Signing in…", keeps keyboard focus, and ignores a second submit; screen readers hear the wait |
| Rate limited (sign-in) | "Too many attempts" with a live countdown from the API's `retryAfter` (the API doubles the wait for repeat offenders) |
| API down | Admin pages: the branded error page, with Try again. The chat is unaffected |
| Admin session expired | Sign in again, then straight back to the same URL (search, filter, sort, page and lead kept) |
| Searching (slow) | Results follow the typing after a 300 ms pause, focus stays in the box, and letters typed while a search loads are kept; the lead count is announced to screen readers |

**Without JavaScript**, signing in and out and browsing the dashboard work, because forms post to their Server Actions and the dashboard is links and GET forms. The chat needs JavaScript.

**SEO and security headers.** The home page has a canonical URL, Open Graph and Twitter tags, JSON-LD structured data (`WebApplication`), `/robots.txt` and `/sitemap.xml`; admin pages are `noindex`. Every page sends a nonce-based Content-Security-Policy and other security headers (see [Security](#security)); PDF previews need `frame-src 'self' blob:`. Set `SITE_URL` (root `.env.example`) to the public address in production.

**Components** follow atomic design (`apps/web/src/components`: atoms, molecules, organisms, templates, enforced by ESLint), use design tokens (the green palette from the Brighte Eats version), and meet WCAG 2.1 AA with **AAA text contrast**. Every component has Storybook stories, and every story is a test with an axe check. Conventions: `apps/web/CLAUDE.md`.

## Why I chose Postgres, NestJS and Next.js

**PostgreSQL.** The data is relational: leads (from the original Brighte Eats brief, see [Project history](#project-history)) have many service interests, service types change, and duplicates must be impossible. Postgres gives foreign keys (a lead can't point at a service that doesn't exist), a unique constraint on email that holds under concurrent requests, and transactions, so a lead and its services are saved together or not at all. It's free, runs in one Docker container, and has a clear path for the id scheme (Postgres 18 adds `uuidv7()`).

**NestJS, Apollo (code-first) and Sequelize for the API.** TypeScript end to end. Code-first GraphQL keeps the schema, its types and the resolvers in one place; `schema.gql` is generated, never hand-edited, and every operation documents its auth rule and error codes (a test enforces it). Nest's guards give one place for the things every request needs: authentication (deny by default), roles, and rate limiting. Sequelize with Umzug migrations keeps schema changes as explicit, reviewable SQL steps with `synchronize` off. Prisma or Drizzle would fit as well; the migrations-first discipline matters more than the ORM.

**Next.js 16 (App Router) with React 19 for the web.** Server Components, Server Actions and route handlers mean **the browser never calls the API or an LLM provider**: pages, forms and the chat talk to the Next server, which calls them. So the API URL, the admin's token and the provider API keys stay on the server (the session is an httpOnly cookie), and the visitor's IP is used for rate limits. The admin forms still work without JavaScript, because a Server Action is also a plain form POST. The dashboard's state (filter, page, selected lead) lives in the URL, so it needs no client JavaScript at all. Tailwind 4 with design tokens, and Storybook, for a small atomic-design component library.

## Project history

This repo began as **Brighte Eats**, a take-home brief: a public form to register interest in an upcoming food service (delivery, pick-up, payment) and a leads dashboard for staff. That is what the API, the database, the admin area, the [slides](docs/slides/index.html) and [docs/architecture.md](docs/architecture.md) were built for, including the stretch goals picked then: the admin boundary (sign-in, `ADMIN`-only `leads`, sliding sessions), rate limiting with backoff on `register` and `login`, and an optimistic registration form.

A chat assistant was added next (`/chat`), then the CV coach on top of it: match reports, profiles, tailored CVs, PDFs and cover letters. The site was then rebranded to CV coach, with the chat as the home page. The registration form was removed from the web app; the API's `register` and `serviceTypes` operations and the leads dashboard remain, with the sample leads from the seed.

## Data modelling trade-offs

The ER diagram, with every column, key and index, is in [docs/architecture.md](docs/architecture.md#database-er-diagram).

The leads come from the original Brighte Eats brief (see [Project history](#project-history)). A lead can be interested in several services, and the service types "may change over time". Three tables (migration `2026.09.25T00.00.00.create-leads.ts`):

| Table | Purpose |
|---|---|
| `service_types` | One row per service: stable `code` (`delivery`, `pick-up`, `payment`), display `label`, `active` flag |
| `leads` | Name, email (unique, stored lowercase), mobile, postcode |
| `lead_service_types` | Join table, primary key `(leadId, serviceTypeId)` |

**Lead ids are UUID v7.** `register` is public and returns the lead, so a sequential id would reveal how many people have signed up (register twice, subtract). UUID v7 can't be guessed and doesn't reveal volume. It's also time-ordered, so inserts append to the primary-key index like a serial id; random UUID v4 values land anywhere in the index and slow writes as the table grows. Postgres 17 has no `uuidv7()`, so the `Lead` model generates the id (`uuid` package) and the column has no default: raw SQL inserts must supply one. Postgres 18 adds `uuidv7()`, which could become the column default. `service_types` keeps integer ids: it's internal reference data, and the API identifies types by `code`.

**Why a join table, not an enum.** A Postgres enum (or a TypeScript enum checked by the API) makes the list of services part of the schema and the code. Adding a type means a migration and a deploy. Removing or renaming a value is worse: Postgres can't drop an enum value, so the type has to be rebuilt and every row rewritten. With a table, a new service is an `INSERT`, and a retired one is `active = false`. Existing leads keep their history, and a foreign key with `ON DELETE RESTRICT` stops a type in use from being deleted. An enum also has nowhere to keep a label or an active flag.

**Why not JSON.** A `services` JSON/array column on `leads` is the quickest thing to write, but the database can't protect it. Nothing stops `["delivry"]`, duplicates, or a code that was never a service, because there's no foreign key into a JSON value. Renaming a service means rewriting every lead's JSON. The dashboard filter "leads interested in X" becomes a JSON containment query that needs a GIN index, and counting leads per service needs `jsonb_array_elements`. With the join table, it's a plain indexed join.

**What the join table costs.** Writes touch two tables, so `register` must insert the lead and its services in one transaction. Reads need a join or a batched lookup; the API uses a per-request DataLoader, so listing leads with their services doesn't cause N+1 queries. Both costs are small at this scale.

**Indexes.** `leads(createdAt, id)` serves the default newest-first sort with a stable tie-breaker for offset pagination. `lead_service_types(serviceTypeId)` serves the filter by service type; the composite primary key already covers lookups by lead. The unique `leads.email` is what duplicate-lead (idempotency) handling relies on. Trigram (`pg_trgm`) GIN indexes on `leads.name`, `leads.email` and `leads.mobile` serve the dashboard search, which matches anywhere in the text (`ILIKE '%term%'`), something a normal index can't do; a `text_pattern_ops` index serves its postcode prefix match. The search is one `OR` across those four columns, and Postgres can combine indexes for an `OR` only when every branch has one, so an e2e test checks the plan uses all four.

## Validation strategy — client vs server

**Both, with the server as the source of truth.**

- **One set of rules.** The registration and sign-in rules and their messages live in one workspace package, `packages/validation` (`@brighte/validation`, Zod's small `zod/mini` build), used by both apps.
- **Server (API).** Every input is parsed with a Zod schema (the shared rules, plus the API-only ones in `apps/api/src/leads/leads.schemas.ts`) before any database work: for `register`, name required and at most 70 characters, a valid email, an Australian mobile, a 4-digit postcode, at least one service. It also normalises: lowercase email, mobile stored as `04xxxxxxxx`, trimmed text, de-duplicated services. A failure returns `BAD_USER_INPUT` with `extensions.fields`, a map from each invalid field to a message. Whether a service code exists (and is still active) is only known to the database, so that check lives only on the server.
- **Browser (web).** `validateSignIn` (`apps/web/src/lib/sign-in.ts`) runs the same shared rules, so mistakes show at once and **nothing is sent**, which also means typos never count against the API's rate limit. It's a convenience, not a security boundary.
- **The chat** validates on both sides too: the page checks message length and files before sending, and `/api/chat` re-checks everything with Zod (`chatRequestSchema`). The model's JSON blocks are parsed with their schemas before they're shown or turned into PDFs.
- **Showing server errors.** The web maps each error code to plain copy (`apps/web/src/lib/api/*-feedback.ts`, `chat-error.ts`, `cv-pdf/errors.ts`); it branches on codes, never on messages.

**Idempotency of `register`.** `leads.email` is unique, and `register` relies on that constraint rather than a prior lookup, so two concurrent registrations with one email can't both succeed: the loser gets `CONFLICT` and nothing changes. `register` is public, so it deliberately doesn't return the existing lead, which would hand anyone who knows an email that person's details.

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
- It also adds 150 sample leads (`apps/api/src/database/seed-leads.ts`): the same ones every time, with `@seed.example.com` emails, one about every 14 hours back to three months ago, and a mix of services and capital-city postcodes. That's 8 pages at the default page size, with enough overlap to try search (`nguyen`, `o'brien`, `3000`), each service filter and every sort. Each lead passes the API's own validation rules, and running the seed again only adds leads that are missing (matched by email).
- The API refuses to start if `JWT_SECRET` is missing or shorter than 32 characters.

## Security

Public operations (`register`, `serviceTypes`, `login`) need no token, so they are hardened at several layers. Everything below is covered by `apps/api/test/security.e2e-spec.ts`. The chat's own protections are under [The CV coach chat](#the-cv-coach-chat).

| Threat | Protection |
|---|---|
| Spam registrations, password guessing, request floods | Rate limits per client IP and per operation (`@nestjs/throttler`): `register` 5/min, `login` 10/min, everything else 120/min, configurable with `RATE_LIMIT_*`. Over the limit: `TOO_MANY_REQUESTS` with `extensions.retryAfter` and a `Retry-After` header. **Backoff:** a client that goes over the same operation's limit again is blocked twice as long each time (60s, 120s, 240s… up to 15 minutes), back to 60s after 15 minutes without a block. Guards run per root field, so aliasing `register` 100 times in one request counts as 100. |
| Expensive or huge queries | Documents over 1000 tokens are rejected before parsing finishes (`GRAPHQL_PARSE_FAILED`); JSON bodies over 100kb get 413; batched requests are off. There is no depth limit because the schema has no recursive types; add one if that changes. |
| Other websites calling the API from a browser | CORS allows only the `WEB_ORIGIN` list (required in production), `GET`/`POST`, and the `Content-Type` and `Authorization` headers, without credentials, since auth is a bearer token rather than a cookie. Apollo's CSRF prevention rejects "simple" requests (e.g. `text/plain`) that skip the CORS preflight. Our own web app never calls the API from the browser (see [Frontend](#frontend)); CORS stays as defence in depth for any browser client. |
| Browser-side attacks on responses | API: `helmet` security headers (`nosniff`, HSTS, frame and referrer policies; CSP in production) and no `X-Powered-By`. Web: a **nonce-based Content-Security-Policy** set per request by `apps/web/src/proxy.ts` (scripts and styles only with that request's nonce, `frame-ancestors 'none'`, `object-src 'none'`, forms only to this site), plus `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` and no `X-Powered-By`; HSTS and `upgrade-insecure-requests` when `SITE_URL` is HTTPS. `apps/web/e2e/security.spec.ts` checks the headers and that the policy blocks nothing the app needs. |
| Schema discovery | Introspection and GraphiQL are off when `NODE_ENV=production` (Apollo and Nest defaults). |
| Leaking internals | Unexpected errors are logged and returned as `Internal server error` (see `formatError`). |
| Injection | All database access goes through Sequelize's query builder, which escapes every value (no raw SQL); inputs are validated with Zod first. Search terms escape `%` and `_`, so they match literally. |
| Secrets in git | None are committed: every `.env` is gitignored and only `.env.example` files are tracked. `JWT_SECRET` and `ANTHROPIC_API_KEY` are empty in the examples (`pnpm bootstrap` generates the JWT secret; the API key is yours to add), and the seed passwords are for local development only. |

**Behind a proxy**, set `TRUST_PROXY` to the number of hops so the limiter sees the client's IP. Otherwise every client shares the proxy's IP and one noisy client throttles everyone.

**The web app is such a proxy.** The browser never calls the API: pages and Server Actions call it from the Next server (`apps/web/src/lib/api`), which keeps the API URL and admin tokens off the client. So in production:

- Run the API with `TRUST_PROXY=1` and make it reachable **only** from the web server (private network). Otherwise anyone could call it directly with a made-up `X-Forwarded-For`.
- Set `WEB_TRUST_PROXY` on the web app to the number of proxies in front of **it** (e.g. `1` behind a load balancer). The web app reads the visitor's IP from those proxies' `X-Forwarded-For` entries and forwards just that IP to the API; entries a client wrote itself are ignored. Unset (local development), nothing is forwarded.
- `API_URL` points the web app at the API (default `http://localhost:${API_PORT}/graphql`).

Without this, every visitor shares the web server's IP, and one visitor's rate limit would be everyone's. The chat's rate limits read the visitor's IP the same way.

**What this does not cover.** App-level rate limiting slows abuse; it does not stop a real DDoS, which has to be absorbed before it reaches Node (a CDN or WAF, e.g. Cloudflare or AWS WAF, plus load balancer limits). Counters are in memory, so each instance counts separately; with several instances, move them to Redis (`@nest-lab/throttler-storage-redis`). A distributed password-guessing attack spreads across IPs, so per-account lockout or a CAPTCHA on repeated failures would be the next step, and a CAPTCHA (e.g. Turnstile) on `register` if bots get past the per-IP limit. Oversized bodies (413) are still logged at ERROR with a stack, which is noisy under attack.

## Observability (API)

The API logs with [nestjs-pino](https://github.com/iamolegga/nestjs-pino): one JSON object per line on stdout, ready for any log collector. Running it in a terminal (`pnpm dev`) pretty-prints instead. `LOG_LEVEL` sets the level (default `info`; e2e tests are silent).

- **Request id.** Every request gets an id, logged as `reqId` on each line written while handling it and returned in the `X-Request-Id` response header. A caller's own `X-Request-Id` is kept if it looks like an id (8 to 128 letters, digits, `-` or `_`), so the web server can pass its id along and both sides log the same one.
- **One line per GraphQL operation.** An HTTP access log would read `POST /graphql 200` for everything, so a GraphQL plugin (`operationLogPlugin`) logs the operation name, root fields, duration, caller (`userId`, `role`) and client IP instead. Info when it succeeds; warn with its error codes (`errors: ["UNAUTHENTICATED"]`) when it fails. Unexpected errors are also logged with their stack by `formatError`. REST requests get pino-http's access line (method, URL, status, time).
- **Security and audit events**, each with an `event` field to alert on: `auth.login`, `auth.login_failed` (`reason`: `unknown_email` or `wrong_password`, with `userId` when the account exists), `auth.session_ended` (renewal refused at the session limit), `rate_limit.blocked` (once per block, with the operation, client IP and how many blocks in a row), `user.created` (who created which account).
- **Never logged:** GraphQL variables (passwords, personal details), request headers (the bearer token), and emails. The smoke test checks the production server's logs for these.
- **Health checks**, public and not rate limited: `GET /health/live` (the process is up; doesn't touch the database, so an outage there doesn't get the API restarted) and `GET /health/ready` (the database answers within 2 seconds; `503` otherwise, so a load balancer sends traffic elsewhere).
- **Database connections** are bounded (`apps/api/src/common/database.ts`): up to `DB_POOL_MAX` (10) per instance, and a request that can't get one within 5 seconds fails instead of queueing. A connection unused for `DB_POOL_IDLE_MS` (10 seconds) is closed, so a quiet instance holds none and never reuses one a proxy or NAT has silently dropped; raise it if reconnecting after quiet periods shows in latency. Postgres cancels any statement running past `DB_STATEMENT_TIMEOUT_MS` (5 seconds) and ends a transaction left idle for 10 seconds, so one slow query or stuck request can't hold a connection forever. Connections are named `brighte-api` in `pg_stat_activity`. Keep instances × `DB_POOL_MAX` under Postgres's `max_connections` (100 by default).

## Database migrations

The schema is owned by [Umzug](https://github.com/sequelize/umzug) migrations in `apps/api/src/database/migrations/`. Sequelize `synchronize` is off, so changing a model does not change the database.

- The history shows the schema evolving in small steps: users, then roles and auth fields on users, then leads and service types, then search indexes.
- Add a migration: create `apps/api/src/database/migrations/<YYYY.MM.DDTHH.mm.ss>.<description>.ts` exporting `up` and `down` (see the existing ones). Files run in name order, and each applied one is recorded in the `SequelizeMeta` table.
- `pnpm db:migrate`: apply pending migrations.
- `pnpm --filter @brighte/api db:migrate:status`: list pending migrations.
- `pnpm --filter @brighte/api db:migrate:undo`: revert the last migration.
- Production: run `node dist/database/migrate.js up` from `apps/api` after `nest build`, before starting the app.

## Testing

Tests are chosen to protect what would hurt most if it broke, not for coverage numbers.

| Layer | Command | What it covers |
|---|---|---|
| API unit | `pnpm --filter @brighte/api test` | Input schemas, error formatting, password hashing, rate-limit backoff, request ids and the operation log, the API docs contract |
| API end-to-end | `pnpm --filter @brighte/api test:e2e` | Every operation against real Postgres (Supertest): register, leads, lead, auth, session renewal, access rules, security limits, N+1 query count, health checks, request ids, security and audit log events |
| API smoke | `pnpm --filter @brighte/api test:smoke` | Builds and starts real servers (dev and production) and checks every operation, edge case and error code over HTTP, plus the production logs: all JSON, and no passwords, emails or tokens |
| Web unit | `pnpm --filter @brighte/web test` | The chat: block schemas, `tailorCv`, persona rules, message and file checks, rate limits, the chat and PDF route handlers, rendered PDF text and layout. Admin: API client, error copy, validation, URL and session helpers |
| Component stories | same command | Every Storybook story renders in Chromium, runs its interaction test, and must pass axe (WCAG 2.1 AA) |
| Web end-to-end | `pnpm test:e2e` | Playwright on mobile and desktop, with axe: the chat against a mock model (`e2e/mock-llm.mjs`: streaming, Markdown, files, each card, PDF and cover letter downloads, preview, rate limit, failures), sign-in, dashboard, sessions, offline, slow submits, API down, 404, SEO files, security headers and CSP |

The e2e suite starts its own production API and web servers (dev ports + 100, so it never touches a running dev setup), a web server whose API is unreachable, and the mock model, so no real provider is ever called. Each test sends its own visitor IP, so tests don't share rate limits. It needs Postgres migrated and seeded. Lighthouse: `pnpm --filter @brighte/web lighthouse` against a running production build: 90+ for Performance and Best Practices, 95+ for Accessibility and 100 for SEO on the home page.

**Load test** (Brighte Eats version; production builds, one process each, on a MacBook Pro M4 Pro; 164k leads; a new visitor IP per request so the real rate limiter stays in the path; 15 s per run; p50 / p99 in ms):

| Scenario | Requests/s | 10 concurrent | 200 concurrent |
|---|---|---|---|
| API `register` (write, one transaction) | 3,400 | 2 / 4 | 61 / 92 |
| API `serviceTypes` (read) | 8,400 | 1 / 2 | 25 / 37 |
| API `leads`, admin, 20 per page | 830 | 26 / 47 | 264 / 365 |
| API `leads` search, admin: before → after the postcode and mobile indexes | 42 → 1,265 | 242 / 368 → 7 / 12 | 4,749 / 5,923 → 159 / 227 |
| Web register page (server-rendered, since removed) | 1,200 | 9 / 40 | 157 / 276 |

The test found that search read the whole table: its `OR` included postcode and mobile, which had no index, so Postgres couldn't use the trigram indexes on name and email. The `add-leads-postcode-mobile-indexes` migration adds them. The slides have the full results and an AWS scaling estimate.

## API collection (Bruno)

`apps/api/bruno/` is a [Bruno](https://www.usebruno.com) collection with every operation. It's plain-text files, so it is versioned and reviewed with the API.

1. Open the folder in Bruno (*Open Collection*), and `cp apps/api/bruno/.env.example apps/api/bruno/.env`. The passwords must match `SEED_*_PASSWORD` in `apps/api/.env`; the `.env` is gitignored.
2. Select the **local** environment and run **1 Auth / Login as admin**. It saves the access token, and every other request sends it as `Authorization: Bearer`. Tokens last 30 minutes (`JWT_EXPIRES_IN`): run **Renew token** to extend the session, or log in again when you get `UNAUTHENTICATED`.
3. **Register** saves the new lead's id, which **Get lead** uses. **4 Access checks** shows `FORBIDDEN`, `UNAUTHENTICATED` and `BAD_USER_INPUT`; it switches to the USER token, so log in as admin again afterwards.

Every request has a test, so the collection also runs from the command line: `cd apps/api/bruno && pnpm dlx @usebruno/cli run --env local -r` (add `--env-var baseUrl=http://localhost:<port>` for another port). Runs create a lead and a user with `bruno-…@example.com` emails in your dev database.

## Scripts

`pnpm dev | build | lint | lint:style | typecheck | test | test:e2e` run across all apps via Turbo; `pnpm storybook` starts the web component library. A pre-commit hook runs ESLint + Stylelint on staged files and a full typecheck (never bypassed with `--no-verify`). Quality rules for Claude Code are in `CLAUDE.md` and `apps/web/CLAUDE.md`.

## What I'd change at 10× scale

- **Pagination.** Offset pages get slow when deep and shift as new leads arrive. Switch `leads` to keyset (cursor) pagination on the existing `(createdAt, id)` index, and stop computing an exact `total` on every page (cache it or show an estimate).
- **Rate limits across instances.** Counters and backoff are in memory, so each API instance counts separately. Move them to Redis, and absorb floods before Node with a CDN/WAF.
- **Sessions that can be revoked.** Tokens can't be cancelled before they expire (signing out only removes the cookie). Keep sessions or refresh tokens server-side (a table or Redis) so "sign out everywhere" and account lockout take effect at once.
- **Database.** A connection pooler (PgBouncer), and a read replica for the dashboard so reads don't compete with registrations.
- **Caching.** Service types are already cached per web instance for 5 minutes (`SERVICE_TYPES_CACHE_SECONDS`); with many instances, a shared cache (Redis) or on-demand revalidation keeps them consistent.
- **Observability.** The API already writes structured logs with request ids (see [Observability](#observability-api)). Next: the same on the web server, sending its request id to the API; tracing across web → API → database (OpenTelemetry); metrics; and alerts on error rates and `rate_limit.blocked` spikes.
- **Search.** Trigram indexes serve substring search well into the millions of rows; beyond that, or for ranking and typo tolerance, move to Postgres full-text search or a search service.
- **Dashboard features.** CSV export, and an audit trail of service-interest changes.
- **Chat.** Rate limits and the model list are kept in memory per web server; with several, move the limits to Redis. Long conversations re-send their files each turn: summarise or store them server-side (e.g. the provider's Files API) to cut cost and latency.
- **Delivery.** CI running the full test suite on every pull request, against a dedicated test database, and deploying the API on a private network behind the web app.

## TODOs / known gaps

- **Running needs Node and pnpm as well as Docker.** To simplify it, I'd add a Compose profile that builds and runs the API and web too, so `docker compose up` alone starts everything.
- **No CI configuration** in the repo yet; quality gates run in the pre-commit hook and locally.
- **Sign out doesn't revoke the token**, only removes the cookie (see 10× scale).
- **Conversations aren't saved.** A chat lives in its browser tab; reloading starts again. Saving the profile as a file (and attaching it later) is the way to carry it over today.
- **Non-Latin scripts in PDFs.** The PDFs use Helvetica (Windows-1252), so a CV or letter in Chinese, Cyrillic or with emoji is refused with the characters named. An embedded Unicode font would fix it.
- **Leftover registration code.** The web app's `RegistrationForm` organism and the registration operations in `apps/web/src/lib/api` aren't used since the sign-up page was removed, and can go.
- **No admin user management UI**; admins are created with `createUser` (ADMIN only) or the dev seed.

- **Security gaps**, from a review against the OWASP Top 10, by priority:
  - High: revocable sessions, with the role rechecked on each request (a removed admin keeps access until the token expires, up to 30 minutes); rate limits and backoff in Redis before running more than one instance; per-account lockout and MFA for admins (per-IP limits don't stop guessing from many IPs).
  - Medium: per-user quotas and alerts on bulk `leads` reads (anti-scraping); CSP reports and browser error reporting; Dependabot and `pnpm audit` in CI (today: one moderate advisory in a `uuid` version pulled in by Sequelize, in functions the app doesn't call); scrypt cost raised to OWASP's minimum (N=2^17); refuse to start in production without `WEB_TRUST_PROXY`, or every visitor shares one rate-limit bucket.
  - Low: `__Host-` cookie prefix with `Secure` tied to HTTPS; COOP and CORP headers on the web; `iss` and `aud` claims on the JWT; a validated env schema; a length check on login arguments before hashing.
- **Tracing across web and API.** The API tags every log line with a request id, but the web neither sends one nor logs its own: generate it in `proxy.ts`, forward it to the API and show it on error pages as a reference code.
- **Graceful shutdown.** Enable Nest's shutdown hooks and let readiness answer 503 while draining, so deploys don't cut requests in flight.
- **Browser coverage.** Automated tests run in Chromium only (desktop and an emulated Pixel 7). Add WebKit (Safari) and Firefox projects to the e2e suite.
- **Lighthouse can't sign in**, so `/admin` was measured by hand with a session cookie (100 for Performance, Accessibility and Best Practices).

## AI Assistance

I built this with Claude Code (Anthropic) as a pair: I set the plan and the constraints, reviewed every pull request, and asked for changes; the AI wrote most of the code, tests and documentation. The history shows it as small pull requests, each reviewed and merged by me.

- **Where AI helped:** the CV coach (the chat, profile reading, match reports, tailoring, cover letters and their PDFs); API features (error handling, the leads data model and operations, security hardening, session renewal); the design tokens and components with their Storybook stories; the pages, Server Actions and session handling; end-to-end, component and smoke tests; this README.
- **Where I verified or changed its output:** I checked each feature in the browser and asked for changes, for example making all text meet AAA contrast, showing hints above errors, a client-side countdown with doubling backoff for rate limits, an account menu in the header, and keeping typed values when offline. Testing caught several of its mistakes: a form reset that broke the no-JavaScript path (found by e2e), an API that rejected `serviceType: null` (found while checking unfiltered dashboard URLs), a duplicated page shell, a skip link with no padding, and a flaky e2e race with session renewal.
- **Limitations:** Next.js 16 is newer than the model's training, so it had to read the bundled Next docs before using APIs such as `proxy.ts`, `retry()` and page metadata, and still made mistakes there (a doubled page title). Simulated events in component tests can't check CSS hover or native `<details>` toggling, so those moved to Playwright. It sometimes widened the scope of a change, which I kept in check in review.
