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
| `pnpm test` | Unit tests (api, Vitest) and component story tests (web: every Storybook story rendered in Chromium, with its `play` function and a WCAG 2.1 AA axe check) |
| `pnpm test:e2e` | Playwright + axe (web). Starts its own production api and web on the dev ports + 100 (4101, 3101), plus a web server on 3102 whose API is unreachable (`e2e/api-down.spec.ts`), never reusing a dev server, with `X-Forwarded-For` trusted so each test is its own visitor for rate limits. Needs `pnpm db:up` |
| `pnpm --filter @brighte/api test:smoke` | Black-box API smoke test: builds, starts real servers (dev, real rate limits, production) on ports 4801-4804 and checks every operation and error code over HTTP. Needs `pnpm db:up`, `db:migrate`, `db:seed` |
| `pnpm --filter @brighte/web lighthouse` | Lighthouse CI against a running app on `WEB_PORT` (root `.env`, default 3001) |

**Pre-commit hook** (husky + lint-staged): ESLint and Stylelint on staged files, then `pnpm typecheck`. Never bypass it with `--no-verify`. Fix the cause instead.

## Rules

- Use pnpm only, never npm or yarn.
- Every change must pass `pnpm lint && pnpm lint:style && pnpm typecheck` before you report it as done.
- API: invoke `nestjs-expert` / `graphql-architect` for back-end design. Use explicit field mapping when writing Sequelize models (no spreading class instances). Use `.js` extensions on relative imports (ESM, `nodenext`).
- API imports (enforced by ESLint `no-restricted-imports` in `apps/api/eslint.config.mjs`):
  - Each module folder (`auth`, `users`, `leads`, `common`) has an `index.ts` barrel exporting its public API. From another module, import only the barrel: `import { Role, Roles } from '../auth/index.js'` (ESM cannot import a bare directory, so `index.js` is spelled out).
  - Barrels never re-export Nest `*.module.ts` classes or module-internal files (resolvers, guards, services only used inside). Import a Nest module by path: `import { UsersModule } from '../users/users.module.js'`. `auth` and `users` depend on each other, and routing module wiring through barrels creates import cycles that leave decorators undefined at load.
  - Inside a module, import sibling files directly (`./user.model.js`), never your own barrel: that is a cycle, and Nest fails at boot ("circular dependency detected inside @InjectModel()").
  - `src/database/**` scripts run uncompiled under Node type stripping and keep direct `.ts` imports: barrels' `.js` paths do not exist before a build, and strip-only mode rejects enums.
