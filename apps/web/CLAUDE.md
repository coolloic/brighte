@AGENTS.md

# Front-end rules (apps/web)

These rules are mandatory for every UI change. They build on `~/.claude/guidelines/ui-ux-guideline.md`; when the two differ, this file wins.

## 1. Skills to invoke before writing UI code

| Stage | Skill |
|---|---|
| Design a component or page | `ui-ux-react-dev`, `ui-ux-pro-max` (and `frontend-design:frontend-design` for new visual design) |
| Write React / Next.js code | `vercel-react-best-practices`, `vercel:nextjs` |
| Accessibility | `accessibility-compliance-accessibility-audit`, `wcag-audit-patterns` |
| SEO | `seo-fundamentals`, `seo-meta-optimizer` |
| E2E tests | `playwright-skill`, `e2e-testing-patterns` |
| Lighthouse / performance | `web-performance-optimization` |
| Before claiming done | `superpowers:verification-before-completion` |

## 2. Atomic design

```
src/components/
  atoms/       # smallest building blocks: Button, Input, Label, Icon. No imports from other component layers.
  molecules/   # small groups of atoms: FormField, SearchBar. Import atoms only.
  organisms/   # page sections: Header, UserList. Import atoms and molecules.
  templates/   # page layouts with slots, no data fetching. Import any layer below.
src/app/       # pages = routes. Fetch data here and pass it into templates/organisms.
```

- ESLint enforces the dependency direction (`no-restricted-imports`): a layer may never import from a layer above it.
- One component per folder: `Button/Button.tsx`, `Button/Button.module.scss` (only if Tailwind is not enough), `Button/index.ts`.
- Atoms and molecules are presentational: props in, markup out, no data fetching, no global state.
- Before creating a new atom or molecule, check whether an existing one can be reused.

## 3. Mobile-first responsive

- Unprefixed Tailwind classes target mobile; add `sm:` / `md:` / `lg:` to scale **up**. Never design desktop-first and patch downward.
- In SCSS, use only `min-width` media queries. Stylelint rejects `max-width`.
- Touch targets must be at least 44×44px. No horizontal scroll at 320px width.
- Verify at 375px (mobile) first, then 768px and 1280px.

## 4. Accessibility (WCAG 2.1 AA) — required for every component

- Use semantic HTML first (`<button>` for actions, `<a>` for navigation, `<nav>`, `<main>`, `<header>`, `<footer>`). Use ARIA only when no native element fits.
- Each page has exactly one `<h1>`, and heading levels go in order without skipping.
- Every input has a `<label htmlFor>`. Every image has meaningful `alt`, or `alt=""` if decorative.
- Everything works by keyboard, with a visible focus ring (≥2px, ≥3:1 contrast). Never use a positive `tabIndex`.
- Text contrast is at least 4.5:1 (3:1 for large text and UI parts). Never use color alone to convey meaning.
- Use `aria-live="polite"` for dynamic updates and `aria-busy` for loading states.
- ESLint runs `jsx-a11y` in strict mode, and the e2e suite runs axe. Both must pass.

## 5. SEO — required for every page

- Export `metadata` or `generateMetadata` from every `page.tsx`, with a unique `title` and `description`, plus `openGraph` for public pages.
- Prefer Server Components so content is in the initial HTML.
- Use `next/image` with `width`/`height` (no layout shift) and `next/link` for internal navigation.
- Use descriptive link text (no "click here"). Add JSON-LD structured data where it applies.

## 6. Definition of done for a UI feature

A feature is not done until all of these pass. Show the output when reporting.

1. `pnpm lint && pnpm lint:style && pnpm typecheck`
2. **E2E**: add or extend a Playwright spec in `e2e/` covering the feature's main user flow **and** an axe WCAG 2.1 AA scan of the page. Run `pnpm test:e2e`. Tests run on the `mobile` and `desktop` projects.
3. **Lighthouse**: start the API and web (`pnpm --filter @brighte/api start:prod`, `pnpm build && pnpm start`), add the new route to `lighthouserc.js` → `ci.collect.url`, run `pnpm lighthouse`. Thresholds: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90.
4. If any score is below its threshold, read the report in `.lighthouseci/`, fix the top issues, and re-run. Repeat until everything passes. Report the final scores.

## 7. Storybook — required for every component

- Every component in `src/components/` has a `<Name>.stories.tsx` next to it, with one story per state (default, focus, error, disabled, loading, empty…). Organisms get stories for each data state, using mock props.
- Put behaviour checks (typing, validation messages, keyboard use) in `play` functions.
- Every story is a test: `pnpm --filter @brighte/web test` renders it in Chromium and fails on a thrown error, a failing `play` function, or any WCAG 2.1 AA violation. Don't turn the a11y check off for a story; fix the component.
- Run it locally with `pnpm --filter @brighte/web storybook` (http://localhost:6006).
- Until pages exist (PR 10 of the frontend plan), story tests replace the Playwright/Lighthouse steps of the definition of done for component-only changes.

## Styling

- Tailwind first; SCSS modules (`*.module.scss`) only for what Tailwind cannot express. Never create `.css` files.
- Use system fonts only (no `next/font/google` or other external font loading).
- Colors go through CSS custom properties in `globals.scss`. Never hardcode brand colors in components.
