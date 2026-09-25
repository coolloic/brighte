# @brighte/web

The Brighte Eats web app: the registration form (`/`), admin sign-in (`/admin/login`) and the leads dashboard (`/admin`). Next.js 16 (App Router), React 19, Tailwind 4 + SCSS.

Setup, scripts and design notes are in the [root README](../../README.md), in particular [Frontend](../../README.md#frontend) and [Testing](../../README.md#testing). Conventions for UI work (atomic design, tokens, accessibility, Storybook, definition of done) are in [`CLAUDE.md`](./CLAUDE.md).

```bash
pnpm --filter @brighte/web dev          # http://localhost:3001 (WEB_PORT)
pnpm --filter @brighte/web storybook    # http://localhost:6006
pnpm --filter @brighte/web test         # unit and component story tests
pnpm --filter @brighte/web test:e2e     # Playwright (starts its own API and web)
```
