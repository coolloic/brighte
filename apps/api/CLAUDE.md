# Back-end rules (apps/api)

These rules are mandatory for every API change. They adapt `~/.claude/guidelines/api-guideline.md` to NestJS + GraphQL; when the two differ, this file wins. Examples: GraphQL schema + Apollo Sandbox instead of OpenAPI, class-validator instead of Zod.

## 1. Skills to invoke

| Stage | Skill |
|---|---|
| Design the schema / API contract | `graphql-architect`, `api-design-principles` |
| Implement NestJS code | `nestjs-expert` |
| Auth, access control, security review | `auth-implementation-patterns`, `api-security-best-practices`, `backend-security-coder` |
| Error handling | `error-handling-patterns` |
| Before claiming done | `superpowers:verification-before-completion` |

## 2. API design first: build the doc before the implementation

**No resolver or controller logic may be written until the contract has been reviewed and approved.**

1. **Write the contract as code**, with no business logic:
   - `@ObjectType` / `@InputType` / `@ArgsType` classes with a `description` on **every** type, field and argument (these become the API docs).
   - Every query and mutation description ends with a `**Auth:**` line (Public / Any signed-in user / role) and an `**Errors:**` line listing each code with its HTTP status, e.g. `` **Errors:** `UNAUTHENTICATED` (401), `FORBIDDEN` (403). `` A unit test (`src/docs.spec.ts`) fails if either is missing.
   - A new error code is added to `src/common/errors/error-codes.ts` **and** to the error table in `spectaql.yml` (the same test checks this).
   - class-validator rules on every input field (see §5).
   - Resolver methods carrying their auth decorators (`@Public()` / `@Roles()`), with bodies that only `throw new AppError('NOT_IMPLEMENTED')` (HTTP 501).
2. **Build the docs**: start the API (`pnpm --filter @brighte/api dev`) so `src/schema.gql` regenerates. Then:
   - run `pnpm --filter @brighte/api docs:build` → `apps/api/docs/index.html`, the static API reference (SpectaQL), and check the new operations, Auth and Errors read correctly
   - open Apollo Sandbox at http://localhost:4001/graphql to try the stubs (they return `NOT_IMPLEMENTED`)
3. **Present the contract to the user and wait for explicit approval.** Include for each operation:
   - name and type (query or mutation)
   - auth level (Public / authenticated / roles) and why that is the least privilege needed
   - inputs with their validation rules
   - output fields
   - every error code it can return
4. Implement the approved contract only. If the contract has to change, go back to step 3.
5. Add e2e tests (`test/*.e2e-spec.ts`) for the happy path **and every error code** listed in the contract, asserting both the HTTP status and `extensions.code`.

## 3. Authentication and authorization: least privilege

- **Deny by default.** `AuthGuard` is global: every resolver and controller requires a valid JWT unless it is marked `@Public()`.
- `@Public()` is the exception. Every use needs a one-line comment explaining why anonymous access is required (sign-in, registration, health check).
- Use `@Roles(Role.X)` for anything beyond "any signed-in user" (admin operations, bulk reads, other users' data).
- **Ownership checks**: when an operation touches a resource by id, check it belongs to `@CurrentUser()` (or that the caller has an elevated role). If not, return `NOT_FOUND` rather than `FORBIDDEN`, so the API doesn't reveal that the resource exists.
- **Never trust client-supplied identity**. Take the caller's id from `@CurrentUser()`, never from input arguments.
- **Expose the minimum**: sensitive columns (password hashes, tokens, internal flags) are never a GraphQL `@Field`, and they're excluded by the model's default scope.
- Access tokens stay short-lived (`JWT_EXPIRES_IN`, default 15m) and are signed with HS256 using `JWT_SECRET` (≥ 32 chars, never committed).
- Introspection and the Sandbox are **disabled in production**.
- Infrastructure: in production the app connects with a DB role that only has the privileges it needs (no superuser, no DDL once migrations exist).

## 4. HTTP status codes

`AllExceptionsFilter` sets the status for both REST and GraphQL (`preserveHttpStatusForExecutionErrors: false`). Use the matching code:

| Status | Code(s) | When |
|---|---|---|
| 200 | – | Success (including GraphQL partial success) |
| 400 | `VALIDATION_FAILED`, `BAD_REQUEST` | Input fails validation; malformed query or unknown field |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Missing or invalid token; wrong login |
| 403 | `FORBIDDEN` | Authenticated but the role is not allowed |
| 404 | `NOT_FOUND` | Resource missing or not owned by the caller |
| 409 | `CONFLICT`, `EMAIL_TAKEN` | Unique or state conflict |
| 501 | `NOT_IMPLEMENTED` | Contract stub, not implemented yet |
| 500 | `INTERNAL_ERROR` | Anything unexpected |

## 5. Input validation: always required

- Every `@InputType` / `@ArgsType` field has class-validator decorators with a **user-friendly `message`**. Strings always have a max length; numbers have bounds; enums use `@IsEnum`.
- Normalise input with class-transformer (`@Transform`), e.g. trim, and lowercase emails.
- The global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted`: unknown fields are rejected. Never disable it per handler.
- Do not accept untyped input (`JSON` scalars, `any`). Scalar args go through `ParseIntPipe` or similar, or are wrapped in an `@ArgsType`.
- Validation failures return `VALIDATION_FAILED` with `extensions.details` shaped as `{ "<field>": ["message", ...] }`.

## 6. Errors and logging

- For expected failures, throw `new AppError(code, details?, internal?)` from `src/common/errors/app.error.ts`. Put debugging context in `internal`: it is logged, never returned.
- A new failure case gets a new entry in `src/common/errors/error-codes.ts`: a stable `SCREAMING_SNAKE` code, the HTTP status, and a friendly message that says what the user can do. Never put internal details (SQL, stack, ids of other users) in a message.
- Do not `try/catch` just to log. Let errors reach `AllExceptionsFilter`, which is the single place that:
  - logs the **real** error with `code`, `status`, `operation`, redacted `args`, `requestId`, `userId`, `ip` (4xx → `warn`, 5xx → `error` + stack)
  - maps it to `{ code, message, details? }` with the correct HTTP status
- `formatGraphqlError` is the final safety net: anything without a known code becomes `INTERNAL_ERROR`, and stack traces never reach clients.
- Use Nest `Logger`, never `console.*`. Never log secrets, tokens, passwords or full emails; pass objects through `redact()`.

## 7. Definition of done for an API change

1. Contract approved (§2) and `src/schema.gql` diff reviewed.
2. `pnpm lint && pnpm typecheck && pnpm test`
3. `pnpm test:e2e` (needs `pnpm db:up`): happy path + every documented error code, asserting status and code.
4. `pnpm --filter @brighte/api docs:build` regenerated, and the API reference reviewed for the changed operations.

## Conventions

- ESM with `nodenext`: relative imports use the `.js` extension.
- Sequelize: map fields explicitly (no spreading class instances); `underscored: true` tables. `synchronize` is dev-only; add migrations before the first production deploy.
