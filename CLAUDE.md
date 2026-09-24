# Brighte monorepo

pnpm workspaces + Turborepo. See `README.md` for setup and ports.

- `apps/web`: Next.js + React front-end. **Read `apps/web/CLAUDE.md` before any UI work.**
- `apps/api`: NestJS + GraphQL (Apollo, code-first) + Sequelize (Postgres). **Read `apps/api/CLAUDE.md` before any API work.** API design comes first and needs approval before implementation.

## Quality gates

| Command (root) | What it checks |
|---|---|
| `pnpm lint` | ESLint: web (Next + jsx-a11y strict + atomic import rules), api (typescript-eslint type-checked) |
| `pnpm lint:style` | Stylelint on web SCSS (standard-scss, mobile-first `min-width` only) |
| `pnpm typecheck` | `tsc --noEmit` for both apps |
| `pnpm test` | Unit tests (api, Vitest) |
| `pnpm test:e2e` | API: auth, authorization, validation and error-code e2e (Vitest + supertest). Web: Playwright + axe (starts api and web automatically). Both need `pnpm db:up` |
| `pnpm --filter @brighte/web lighthouse` | Lighthouse CI against a running app on :3001 |

**Pre-commit hook** (husky + lint-staged): ESLint and Stylelint on staged files, then `pnpm typecheck`. Never bypass it with `--no-verify`. Fix the cause instead.

## Rules

- Use pnpm only, never npm or yarn.
- Every change must pass `pnpm lint && pnpm lint:style && pnpm typecheck` before you report it as done.
- **Git workflow**: never commit or push to `main`. Do every piece of work on a feature branch (`feat/…`, `fix/…`, `chore/…`) and merge it only through a reviewed PR. Claude does not commit unless the user explicitly asks in that session.
