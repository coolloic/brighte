# Brighte monorepo

pnpm workspaces + Turborepo. See `README.md` for setup and ports.

- `apps/web`: Next.js + React front-end. **Read `apps/web/CLAUDE.md` before any UI work.**
- `apps/api`: NestJS + GraphQL (Apollo, code-first) + Sequelize (Postgres).

## Quality gates

| Command (root) | What it checks |
|---|---|
| `pnpm lint` | ESLint: web (Next + jsx-a11y strict + atomic import rules), api (typescript-eslint type-checked) |
| `pnpm lint:style` | Stylelint on web SCSS (standard-scss, mobile-first `min-width` only) |
| `pnpm typecheck` | `tsc --noEmit` for both apps |
| `pnpm test` | Unit tests (api, Vitest) |
| `pnpm test:e2e` | Playwright + axe (web; starts api and web automatically, needs `pnpm db:up`) |
| `pnpm --filter @brighte/web lighthouse` | Lighthouse CI against a running app on :3001 |

**Pre-commit hook** (husky + lint-staged): ESLint and Stylelint on staged files, then `pnpm typecheck`. Never bypass it with `--no-verify`. Fix the cause instead.

## Rules

- Use pnpm only, never npm or yarn.
- Every change must pass `pnpm lint && pnpm lint:style && pnpm typecheck` before you report it as done.
- API: invoke `nestjs-expert` / `graphql-architect` for back-end design. Use explicit field mapping when writing Sequelize models (no spreading class instances). Use `.js` extensions on relative imports (ESM, `nodenext`).
