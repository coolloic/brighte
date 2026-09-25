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

## Data: calling the API

- Only the Next server calls the API. Server Components and Server Actions use the functions in `src/lib/api/` (server-only: they import `server-only`, so a Client Component importing them fails the build). The browser never calls the API, and `process.env` is read only there.
- Add an operation as a function next to its feature (`registration.ts`), built on `graphql()` from `client.ts`. Return only the fields the UI needs.
- `graphql()` throws `ApiError` with the API's `code`. Branch on `code`, never on `message`, and turn it into user-facing copy in `src/lib/api` (e.g. `registrationFeedback`) before it reaches a component. Don't show API messages or error details to users, except field messages from `BAD_USER_INPUT`.

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
- Text contrast is WCAG **AAA**: at least 7:1, or 4.5:1 for large text (≥18.66px bold or ≥24px). UI parts (borders, focus rings, checked controls) at least 3:1. Use the role tokens: their pairings are enforced by the Foundations/Colors Contrast story. Never use color alone to convey meaning.
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

- Every component in `src/components/` has a `<Name>.stories.tsx` next to it (exception: `atoms/Icon` is documented and tested in **Foundations / Icons**, the icon catalogue), with one story per state (default, focus, error, disabled, loading, empty…). Organisms get stories for each data state, using mock props.
- Put behaviour checks (typing, validation messages, keyboard use) in `play` functions.
- After an interaction, an element with a CSS transition is mid-fade: `await Promise.all(el.getAnimations().map((a) => a.finished))` before checking its computed colors. Don't use `waitFor` around Storybook's `expect` in play functions: in the Vitest runner it can hang instead of timing out.
- `userEvent.hover` fires simulated events, so CSS `:hover` (and `group-hover:`) never applies in story tests. Don't assert hover styles there; check them in Storybook or with a real pointer (Playwright).
- Every story is a test: `pnpm --filter @brighte/web test` renders it in Chromium and fails on a thrown error, a failing `play` function, or any WCAG 2.1 AA violation. Don't turn the a11y check off for a story; fix the component.
- Run it locally with `pnpm --filter @brighte/web storybook` (http://localhost:6006).
- Until pages exist (PR 10 of the frontend plan), story tests replace the Playwright/Lighthouse steps of the definition of done for component-only changes.

## Styling

- Tailwind first; SCSS modules (`*.module.scss`) only for what Tailwind cannot express. Never create `.css` files.
- Keep class lists readable:
  - **Repeated groups get a name**: when the same few classes appear in several components (e.g. the focus ring), make a Tailwind `@utility` in `globals.scss` and use that one class.
  - **Variants** (size, tone, state): declare them with `cva` (class-variance-authority) and type the props with `VariantProps`. See `atoms/Button`.
  - Simple components keep one class string, with a comment only where a class needs explaining.
  - **Merging**: build `className` with `cn()` from `@/lib/cn` (clsx + tailwind-merge), the caller's `className` last. It doesn't shorten anything; it makes a caller's class replace a clashing one instead of both applying. A new `--radius-*`, `--shadow-*` or `--text-*` token must be added to `cn.ts` too; `cn.test.ts` fails otherwise.
- Font sizes are fluid `clamp()` tokens in `globals.scss`: the mobile size up to 360px wide, the desktop size from 1280px, growing with `vw` in between (plus a `rem` part, so browser font settings still apply). Body and inputs `text-body` (16→18px, `body` already uses it), intro `text-lead` (18→20px), buttons `text-button` (20→22px), headings through the `Heading` atom (`text-heading-xl/lg/md/sm`: 30→40, 24→30, 20→22, 18→20px). Small text (`text-sm` hints, labels, badges) stays fixed at 14px. Don't use Tailwind's `text-lg`/`text-3xl` etc. for these roles.
- No CSS-in-JS (styled-components, Emotion): it needs Client Components and runtime styling, and would duplicate the tokens.
- Import from `src/` with the `@/` alias (`@/lib/cn`, `@/components/atoms/Button`), not `../../` chains; ESLint rejects those. Same-folder and sibling imports (`./`, `../Spinner`) are fine.
- Use system fonts only (no `next/font/google` or other external font loading).
- Colors go through CSS custom properties in `globals.scss`. Never hardcode brand colors in components.
- Use the **role** tokens (`bg-action`, `text-fg-muted`, `border-danger`…), not palette colors (`green-500`). The roles, their Tailwind classes and contrast are in Storybook under **Foundations / Colors**. Tailwind's default palette is switched off, so `bg-zinc-600` and similar don't exist.
- Focus rings: `focus-visible:focus-ring` (a named utility in `globals.scss`). Don't put `transition-colors` on focusable elements: in Tailwind 4 it also animates `outline-color`, so the ring fades in instead of appearing at once. Transition only what changes, e.g. `transition-[background-color]`.
