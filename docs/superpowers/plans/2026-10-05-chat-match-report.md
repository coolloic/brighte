# Chat Match Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `career` ("CV coach") persona whose replies can contain a ` ```match ` JSON block, rendered in the chat as a `MatchReport` component (score, and each requirement's status, evidence and suggestion).

**Architecture:** The model writes a fenced code block whose language names a component. The `Markdown` atom gets a generic `blocks` prop (language → renderer); `ChatBubble` registers `match`, which validates the JSON with a Zod schema and renders `MatchReport`, a placeholder while streaming, or a short note when invalid. Provider clients, the `/api/chat` stream, the request schema and the history format do not change: a reply stays one string.

**Tech Stack:** Next.js 16, React 19 (React Compiler on), Tailwind 4, Zod 4 (`z.toJSONSchema`), react-markdown 10 + remark-gfm, Storybook 10 with the Vitest addon (Chromium + axe), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-05-chat-match-report-design.md`

## Global Constraints

- Shell: `pnpm` and Node 24 are not on the agent's PATH. Prefix commands with `export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH;`.
- pnpm only, never npm or yarn. Working branch: `feat/chat-match-report` (stacked on `feat/chat-markdown`, PR #60).
- **Never commit, push or open a PR unless the user asks.** Each task ends with a checks step instead of a commit. Leave changes uncommitted; reviewers use `git diff`.
- Read `apps/web/CLAUDE.md` before UI work: atomic layers (atoms import no other component layer; molecules import atoms and molecules; organisms import below), one component per folder with `index.ts` and `<Name>.stories.tsx`, `@/` imports, role tokens only (no palette colours), `cn()` for class merging, `focus-visible:focus-ring`, no inline `style` attributes in markup (the CSP blocks them).
- `src/lib/chat/index.ts` is browser-safe; `src/lib/chat/server.ts` is server-only. Inside `src/lib/chat/`, import sibling files directly (`./match-block`), never the folder's own barrel.
- Text contrast AAA (7:1) via role tokens; touch targets ≥44px for interactive elements; works at 320px with no horizontal page scroll.
- Never-invent rule (career persona): reword, reorder and emphasise only what is in the CV; never invent experience, skills, dates or qualifications; unmet requirements are `missing` with an honest suggestion.
- Numbers from the spec: `career` maxOutputTokens 4096, maxMessageChars 8000; `brighte`/`general` 1024 and 1000; `MAX_REPLY_CHARS` 40_000; items 1–30; title ≤120, requirement ≤200, summary/evidence/suggestion ≤400 chars; score 0–100.
- Copy: badge words "Met" / "Partly" / "Missing"; count line "N met · N partly · N missing" (omit zero counts); score "N% match"; placeholder "Preparing match report…"; failure note "This match report couldn't be shown."
- Definition of done (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck`; `pnpm --filter @brighte/web test`; `pnpm --filter @brighte/web test:e2e e2e/chat.spec.ts` (needs `pnpm db:up`); Lighthouse on `/chat` ≥ 90/95/90/90.

## Review Focus

- A model writes a decimal score (`72.5`): expect the report to show `73% match`, not the failure note. Pinned in Task 1.
- A model adds extra fields or leaves `evidence`/`suggestion` out: expect the report to render without them. Pinned in Task 1.
- A reply contains a code block whose language is an `Object.prototype` name (` ```constructor `, ` ```toString `): expect an ordinary code block, not a crash. Pinned in Task 4.
- The reply is cut off by the token cap mid-JSON: expect the failure note once streaming ends, never a placeholder spinning forever. Pinned in Task 6 (story) and Task 7 (e2e `[match-broken]`).
- A visitor pastes a long job description with `CHAT_PERSONA=career`: expect it accepted up to 8,000 characters by both the browser check and the server, while `brighte` keeps 1,000. Pinned in Task 2.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/chat/match-block.ts` | Create | `match` block: language name, Zod schema, types, `parseMatchBlock` |
| `apps/web/src/lib/chat/match-block.test.ts` | Create | Schema and parser tests |
| `apps/web/src/lib/chat/index.ts` | Modify | Export the match block API (browser-safe) |
| `apps/web/src/lib/chat/config.ts` (+ test) | Modify | `maxMessageChars` / `maxOutputTokens` become optional env overrides |
| `apps/web/src/lib/chat/personas.ts` (+ new test) | Modify | Per-persona limits, `career` persona, `configuredPersona()` |
| `apps/web/src/lib/chat/server.ts` | Modify | Export `configuredPersona` |
| `apps/web/src/lib/chat/messages.ts` | Modify | `MAX_REPLY_CHARS` 40_000 |
| `apps/web/src/app/api/chat/route.ts`, `apps/web/src/app/chat/page.tsx` | Modify | Use the configured persona's limits |
| `.env.example`, `apps/web/playwright.config.ts` | Modify | Document `career`; pin the e2e persona |
| `apps/web/src/components/atoms/Badge/*` | Modify | `success` / `warning` / `danger` tones |
| `apps/web/src/components/atoms/Markdown/*` | Modify | `blocks` prop |
| `apps/web/src/components/molecules/MatchReport/*` | Create | The report component |
| `apps/web/src/components/molecules/ChatBubble/*` | Modify | `streaming` prop, `match` block renderer |
| `apps/web/src/components/organisms/ChatWindow/ChatWindow.tsx` | Modify | Pass `streaming` to the newest assistant bubble |
| `apps/web/e2e/mock-llm.mjs`, `apps/web/e2e/chat.spec.ts` | Modify | `[match]` / `[match-broken]` markers and tests |

---

### Task 1: The `match` block schema and parser

**Files:**
- Create: `apps/web/src/lib/chat/match-block.ts`
- Create: `apps/web/src/lib/chat/match-block.test.ts`
- Modify: `apps/web/src/lib/chat/index.ts`

**Interfaces:**
- Produces (from `@/lib/chat`): `MATCH_BLOCK: "match"`, `matchBlockSchema` (Zod), `type MatchBlock`, `type MatchItem`, `type MatchStatus = "met" | "partial" | "missing"`, `parseMatchBlock(code: string): MatchBlock | undefined`.

- [ ] **Step 1: Write the failing tests** — `apps/web/src/lib/chat/match-block.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseMatchBlock } from "./match-block";

const valid = {
  title: "Senior Front-end Engineer · Acme",
  score: 72,
  summary: "Strong React match; no GraphQL yet.",
  items: [
    { requirement: "5+ years React", status: "met", evidence: "8 years React at Acme and Globex" },
    { requirement: "GraphQL", status: "missing", suggestion: "Mention the Apollo course if you took it." },
  ],
};
const parse = (value: unknown) => parseMatchBlock(JSON.stringify(value));

describe("parseMatchBlock", () => {
  it("accepts a valid block", () => {
    expect(parse(valid)).toEqual(valid);
  });

  it("rounds a decimal score", () => {
    expect(parse({ ...valid, score: 72.5 })?.score).toBe(73);
  });

  it("ignores extra fields and allows evidence and suggestion to be left out", () => {
    const block = parse({ ...valid, extra: true, items: [{ requirement: "React", status: "partial", note: "x" }] });
    expect(block?.items).toEqual([{ requirement: "React", status: "partial" }]);
    expect(block).not.toHaveProperty("extra");
  });

  it.each([
    ["a score over 100", { ...valid, score: 101 }],
    ["a negative score", { ...valid, score: -1 }],
    ["no items", { ...valid, items: [] }],
    ["31 items", { ...valid, items: Array.from({ length: 31 }, () => valid.items[0]) }],
    ["an unknown status", { ...valid, items: [{ requirement: "React", status: "Met" }] }],
    ["a missing title", { ...valid, title: undefined }],
    ["a requirement over 200 characters", { ...valid, items: [{ requirement: "a".repeat(201), status: "met" }] }],
    ["a summary over 400 characters", { ...valid, summary: "a".repeat(401) }],
  ])("rejects %s", (_, block) => {
    expect(parse(block)).toBeUndefined();
  });

  it.each(["", "{", '{"title": "Acme", "score": 7', "not json"])("returns undefined for incomplete or invalid JSON: %j", (code) => {
    expect(parseMatchBlock(code)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/match-block.test.ts`
Expected: FAIL, cannot resolve `./match-block`.

- [ ] **Step 3: Implement** — `apps/web/src/lib/chat/match-block.ts`

```ts
import { z } from "zod";

// A "match" block: a reply's fenced code block (```match) holding JSON, shown in the chat as a match
// report. Generic on purpose: anything checked against a list of criteria fits, e.g. a CV against a
// job ad. The same schema checks what the model wrote and, as JSON Schema, teaches the model the
// format (the career persona's prompt), so the two can't drift apart.

/** The code block language that marks a match block. */
export const MATCH_BLOCK = "match";

const text = (max: number) => z.string().trim().max(max);

export const matchBlockSchema = z.object({
  title: text(120).min(1),
  /** Overall fit, 0–100. A decimal from the model is rounded rather than refused. */
  score: z.number().min(0).max(100).transform(Math.round),
  summary: text(400).optional(),
  items: z
    .array(
      z.object({
        requirement: text(200).min(1),
        status: z.enum(["met", "partial", "missing"]),
        /** What in the source (e.g. the CV) shows it. */
        evidence: text(400).optional(),
        /** An honest next step, for partial or missing items. */
        suggestion: text(400).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export type MatchBlock = z.infer<typeof matchBlockSchema>;
export type MatchItem = MatchBlock["items"][number];
export type MatchStatus = MatchItem["status"];

/** The block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseMatchBlock(code: string): MatchBlock | undefined {
  let json: unknown;
  try {
    json = JSON.parse(code);
  } catch {
    return undefined;
  }
  const result = matchBlockSchema.safeParse(json);
  return result.success ? result.data : undefined;
}
```

Append to `apps/web/src/lib/chat/index.ts`:

```ts
export { MATCH_BLOCK, matchBlockSchema, parseMatchBlock, type MatchBlock, type MatchItem, type MatchStatus } from "./match-block";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/match-block.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm typecheck`
Expected: both succeed.

---

### Task 2: Per-persona limits and the `career` persona

**Files:**
- Modify: `apps/web/src/lib/chat/config.ts`, `apps/web/src/lib/chat/config.test.ts`
- Modify: `apps/web/src/lib/chat/personas.ts`
- Create: `apps/web/src/lib/chat/personas.test.ts`
- Modify: `apps/web/src/lib/chat/server.ts`, `apps/web/src/lib/chat/messages.ts`
- Modify: `apps/web/src/app/api/chat/route.ts`, `apps/web/src/app/chat/page.tsx`
- Modify: `.env.example`, `apps/web/playwright.config.ts`

**Interfaces:**
- Consumes: `matchBlockSchema`, `MATCH_BLOCK` from `./match-block` (Task 1).
- Produces: `Persona` gains `maxMessageChars: number` and `maxOutputTokens: number`; `chatConfig()` returns `maxMessageChars?: number` and `maxOutputTokens?: number` (undefined when the env var is unset or invalid); `configuredPersona(config: Pick<ChatConfig, "persona" | "maxMessageChars" | "maxOutputTokens">): Persona` exported from `@/lib/chat/server`.

- [ ] **Step 1: Update the config test** — in `apps/web/src/lib/chat/config.test.ts`, change the defaults expectation so both limits are `undefined` (unset means "the persona decides"), and add an invalid-value case:

```ts
  it("has defaults", () => {
    expect(chatConfig({})).toEqual({
      rateLimit: 20,
      rateLimitWindowSeconds: 600,
      // Unset: the persona's own limits apply (personas.ts).
      maxMessageChars: undefined,
      maxFiles: 3,
      maxFileBytes: 5 * 1024 * 1024,
      maxRequestBytes: 10 * 1024 * 1024,
      maxOutputTokens: undefined,
      modelPatterns: DEFAULT_MODEL_PATTERNS,
      modelsCacheSeconds: 3600,
      defaultModel: "anthropic:claude-haiku-4-5",
      persona: "brighte",
    });
  });
```

and after the existing `it.each(... "falls back on an invalid number" ...)` block add:

```ts
  it.each(["0", "abc", ""])("leaves the persona's limits in place on an invalid override: %j", (value) => {
    const config = chatConfig({ CHAT_MAX_MESSAGE_CHARS: value, CHAT_MAX_OUTPUT_TOKENS: value });
    expect(config.maxMessageChars).toBeUndefined();
    expect(config.maxOutputTokens).toBeUndefined();
  });
```

- [ ] **Step 2: Write the persona tests** — `apps/web/src/lib/chat/personas.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { configuredPersona, getPersona } from "./personas";

describe("personas", () => {
  it("falls back to the Brighte Eats persona for an unknown id", () => {
    expect(getPersona("nope").name).toBe("Brighte Eats assistant");
  });

  it.each([
    ["brighte", 1000, 1024],
    ["general", 1000, 1024],
    // A pasted job ad is long, and a match report is long JSON.
    ["career", 8000, 4096],
  ])("%s has its own limits", (id, maxMessageChars, maxOutputTokens) => {
    expect(getPersona(id)).toMatchObject({ maxMessageChars, maxOutputTokens });
  });

  it("teaches the career persona the match block format and the never-invent rule", () => {
    const { system } = getPersona("career");
    expect(system).toContain("```match");
    // The JSON Schema, generated from matchBlockSchema.
    expect(system).toContain('"requirement"');
    expect(system).toContain('"enum":["met","partial","missing"]');
    expect(system).toMatch(/never invent/i);
  });

  it("lets the env override a persona's limits", () => {
    expect(configuredPersona({ persona: "career", maxMessageChars: 2000, maxOutputTokens: undefined })).toMatchObject({
      maxMessageChars: 2000,
      maxOutputTokens: 4096,
    });
    expect(configuredPersona({ persona: "brighte", maxMessageChars: undefined, maxOutputTokens: 512 })).toMatchObject({
      maxMessageChars: 1000,
      maxOutputTokens: 512,
    });
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/config.test.ts src/lib/chat/personas.test.ts`
Expected: FAIL (`maxMessageChars` is 1000 not undefined; `configuredPersona` is not exported; no `career` persona).

- [ ] **Step 4: Implement config** — in `apps/web/src/lib/chat/config.ts`, add below `positiveInt`:

```ts
/** A whole number of 1 or more from env, or undefined (unset or invalid): for settings with another default. */
function optionalPositiveInt(env: Env, name: string): number | undefined {
  const value = Number(env[name]);
  return env[name] && Number.isInteger(value) && value > 0 ? value : undefined;
}
```

and replace the two entries:

```ts
    /** Longest message a visitor may send, in characters. Unset: the persona's own (personas.ts). */
    maxMessageChars: optionalPositiveInt(env, "CHAT_MAX_MESSAGE_CHARS"),
```

```ts
    /** Cap on each reply's length, in tokens: bounds the cost of one message. Unset: the persona's own. */
    maxOutputTokens: optionalPositiveInt(env, "CHAT_MAX_OUTPUT_TOKENS"),
```

- [ ] **Step 5: Implement personas** — in `apps/web/src/lib/chat/personas.ts`:

Add imports at the top:

```ts
import { z } from "zod";
import type { ChatConfig } from "./config";
import { MATCH_BLOCK, matchBlockSchema } from "./match-block";
```

Add to the `Persona` type (after `system: string;`):

```ts
  /** Longest message a visitor may send, in characters (CHAT_MAX_MESSAGE_CHARS overrides it). */
  maxMessageChars: number;
  /** Cap on each reply, in tokens (CHAT_MAX_OUTPUT_TOKENS overrides it). */
  maxOutputTokens: number;
```

Add `maxMessageChars: 1000, maxOutputTokens: 1024,` to both `brighte` and `general`.

Add the career persona before `const PERSONAS`:

```ts
const MATCH_EXAMPLE = {
  title: "Senior Front-end Engineer · Acme",
  score: 72,
  summary: "Strong React and accessibility match; GraphQL isn't shown.",
  items: [
    { requirement: "5+ years React", status: "met", evidence: "8 years of React at Acme and Globex" },
    { requirement: "Team leadership", status: "partial", evidence: "Mentored 2 graduates", suggestion: "Say how many people you mentored and what changed." },
    { requirement: "GraphQL", status: "missing", suggestion: "If you've used it, add where; if not, it's a gap to mention honestly." },
  ],
};

const career: Persona = {
  name: "CV coach",
  title: "CV coach",
  description: "Check how well your CV matches a job, and which skills to highlight.",
  greeting: "Hi! Attach your CV and the job description (or paste the text), and I'll show how well they match.",
  suggestions: ["How well does my CV match this job?", "Which skills should I highlight?", "What's missing for this role?"],
  maxMessageChars: 8000,
  maxOutputTokens: 4096,
  system: `You are a CV coach. You help people see how well their CV matches a job description, and how to present their real experience for it, including for automated CV screening (ATS): the job ad's own words for skills the person really has, plain headings, no tables or graphics.

Never invent experience, skills, employers, dates or qualifications. Work only from what the CV says: you may reword, reorder and emphasise it. When the CV doesn't show a requirement, it is missing: say so, and suggest an honest next step.

When you have both a CV and a job description and are asked how well they match (or the visitor's question needs it), write one or two sentences, then a match report as a fenced code block with the language "${MATCH_BLOCK}" holding only JSON in this format (JSON Schema):

${JSON.stringify(z.toJSONSchema(matchBlockSchema, { io: "input" }))}

- One item per requirement in the job ad, in its order (at most 30). status: "met" (the CV clearly shows it), "partial" (some of it), "missing" (not shown).
- evidence: what in the CV shows it, briefly. suggestion: for partial and missing items, an honest next step.
- score: overall fit from 0 to 100, weighting essential requirements most.

Example:

\`\`\`${MATCH_BLOCK}
${JSON.stringify(MATCH_EXAMPLE, null, 2)}
\`\`\`

If the CV or the job description is missing, ask for it. Replies are shown as Markdown: use lists and bold text where they help. Write in Australian English.`,
};
```

Change `const PERSONAS: Record<string, Persona> = { brighte, general };` to `{ brighte, general, career }`, and add after `getPersona`:

```ts
/** The persona CHAT_PERSONA picks, with CHAT_MAX_MESSAGE_CHARS and CHAT_MAX_OUTPUT_TOKENS overriding its limits when set. */
export function configuredPersona(config: Pick<ChatConfig, "persona" | "maxMessageChars" | "maxOutputTokens">): Persona {
  const persona = getPersona(config.persona);
  return {
    ...persona,
    maxMessageChars: config.maxMessageChars ?? persona.maxMessageChars,
    maxOutputTokens: config.maxOutputTokens ?? persona.maxOutputTokens,
  };
}
```

Note the persona-level doc comment in `getPersona` stays. The test asserts `'"enum":["met","partial","missing"]'`; `JSON.stringify` without spacing produces exactly that.

- [ ] **Step 6: Export and wire** —

`apps/web/src/lib/chat/server.ts`: change the personas line to
```ts
export { configuredPersona, getPersona, type Persona } from "./personas";
```

`apps/web/src/lib/chat/messages.ts`: change
```ts
/** Longest earlier assistant reply accepted back from the browser (a reply is capped in tokens; this is generous). */
const MAX_REPLY_CHARS = 16_000;
```
to
```ts
/** Longest earlier assistant reply accepted back from the browser: a 4,096-token reply full of JSON fits. */
const MAX_REPLY_CHARS = 40_000;
```

`apps/web/src/app/api/chat/route.ts`: replace the file body with

```ts
import { chatConfig, configuredPersona, createRateLimiter, handleChat } from "@/lib/chat/server";
import { getClient, modelCatalog } from "@/lib/llm/server";

// Settings are read once, when the server starts (root .env).
const config = chatConfig();
const persona = configuredPersona(config);
const takeRateLimit = createRateLimiter({ limit: config.rateLimit, windowMs: config.rateLimitWindowSeconds * 1000 });

/** The chatbot: streams the picked model's reply. The browser calls this; the provider API keys never leave the server. */
export function POST(request: Request) {
  return handleChat(request, {
    catalog: modelCatalog,
    getClient,
    takeRateLimit,
    system: persona.system,
    limits: { ...config, maxMessageChars: persona.maxMessageChars },
    maxOutputTokens: persona.maxOutputTokens,
    trustedHops: Number(process.env.WEB_TRUST_PROXY ?? 0),
  });
}
```

`apps/web/src/app/chat/page.tsx`: change the import to `import { chatConfig, configuredPersona, getPersona } from "@/lib/chat/server";`, in `ChatPage` replace `const persona = getPersona(config.persona);` with `const persona = configuredPersona(config);`, and replace `maxChars={config.maxMessageChars}` with `maxChars={persona.maxMessageChars}`. (`generateMetadata` keeps `getPersona`: it needs only title and description.)

- [ ] **Step 7: Docs and e2e pin** —

`.env.example`: replace
```
# Longest message a visitor may send (characters), and longest reply (tokens).
# CHAT_MAX_MESSAGE_CHARS=1000
# CHAT_MAX_OUTPUT_TOKENS=1024
# Who answers: brighte (Brighte Eats only) or general (no topic limits). See src/lib/chat/personas.ts.
# CHAT_PERSONA=brighte
```
with
```
# Longest message a visitor may send (characters), and longest reply (tokens). Unset: the persona's
# own (brighte and general 1000 / 1024; career 8000 / 4096, for pasted job ads and match reports).
# CHAT_MAX_MESSAGE_CHARS=1000
# CHAT_MAX_OUTPUT_TOKENS=1024
# Who answers: brighte (Brighte Eats only), general (no topic limits) or career (CV coach: matches a
# CV against a job description). See src/lib/chat/personas.ts.
# CHAT_PERSONA=brighte
```

`apps/web/playwright.config.ts`: in the main web server's `env`, after `CHAT_RATE_LIMIT: "3",` add
```ts
        // The tests expect the Brighte Eats persona and its limits, whatever the root .env picks.
        CHAT_PERSONA: "brighte",
        CHAT_MAX_MESSAGE_CHARS: "",
        CHAT_MAX_OUTPUT_TOKENS: "",
```
(An empty value means "unset" to `optionalPositiveInt`, and dotenv does not override variables already in the environment.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat`
Expected: PASS (config, personas, messages, handle-chat and the rest).

- [ ] **Step 9: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm typecheck`
Expected: both succeed.

---

### Task 3: Badge status tones

**Files:**
- Modify: `apps/web/src/components/atoms/Badge/Badge.tsx`, `apps/web/src/components/atoms/Badge/Badge.stories.tsx`

**Interfaces:**
- Produces: `<Badge tone="success" | "warning" | "danger">`.

- [ ] **Step 1: Write the failing story** — append to `Badge.stories.tsx`:

```tsx
/** Status tones, e.g. a match report's Met / Partly / Missing. AAA text on each tint (Foundations / Colors). */
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="success">Met</Badge>
      <Badge tone="warning">Partly</Badge>
      <Badge tone="danger">Missing</Badge>
    </div>
  ),
  play: async ({ canvas }) => {
    for (const [text, tone] of [["Met", "success"], ["Partly", "warning"], ["Missing", "danger"]] as const) {
      const badge = canvas.getByText(text);
      await expect(getComputedStyle(badge).backgroundColor).toBe(rgb(`${tone}-surface`));
      await expect(getComputedStyle(badge).color).toBe(rgb(tone));
    }
  },
};
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/atoms/Badge`
Expected: FAIL (typecheck in the story or wrong colours: the tones don't exist).

- [ ] **Step 3: Implement** — in `Badge.tsx`, add to `tone` after `outline`:

```ts
      // Statuses: text-safe shades on their own tints (AAA, checked in Foundations / Colors).
      success: "bg-success-surface text-success",
      warning: "bg-warning-surface text-warning",
      danger: "bg-danger-surface text-danger",
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/atoms/Badge`
Expected: PASS, no axe violations.

- [ ] **Step 5: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm typecheck`

---

### Task 4: `Markdown` renders registered code blocks

**Files:**
- Modify: `apps/web/src/components/atoms/Markdown/Markdown.tsx`, `index.ts`, `Markdown.stories.tsx`

**Interfaces:**
- Produces: `MarkdownProps.blocks?: MarkdownBlocks`, `type MarkdownBlocks = Record<string, (code: string) => ReactNode>` (exported from `@/components/atoms/Markdown`). A fenced block whose language is an **own** key of `blocks` renders through that function with the block's raw text; anything else renders as `<pre>`.

- [ ] **Step 1: Write the failing stories** — append to `Markdown.stories.tsx`:

```tsx
/** Fenced blocks in a registered language render through their function; other languages stay code. */
export const CustomBlock: Story = {
  args: {
    children: 'Before.\n\n```shout\nhello\n```\n\n```ts\nconst a = 1;\n```\n\n```constructor\nnot a block\n```\n\nAfter.',
    blocks: { shout: (code) => <p data-testid="shout">{code.trim().toUpperCase()}!</p> },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByTestId("shout")).toHaveTextContent("HELLO!");
    // Unregistered languages, including names every object has, are ordinary code blocks.
    const pres = canvasElement.querySelectorAll("pre");
    await expect(pres).toHaveLength(2);
    await expect(pres[0]).toHaveTextContent("const a = 1;");
    await expect(pres[1]).toHaveTextContent("not a block");
    await expect(canvas.getByText("After.")).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/atoms/Markdown`
Expected: FAIL (`shout` test id not found).

- [ ] **Step 3: Implement** — in `Markdown.tsx`:

Change the imports to

```tsx
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

/** Code block languages rendered as components: ```match → blocks.match(the block's text). */
export type MarkdownBlocks = Record<string, (code: string) => ReactNode>;

export type MarkdownProps = {
  /** Markdown text, e.g. a model's reply. It may be incomplete while it streams in. */
  children: string;
  /** Fenced code blocks to render as components, by language. Other blocks render as code. */
  blocks?: MarkdownBlocks;
  className?: string;
};
```

Add after the `components` object:

```tsx
const PRE_CLASS = "my-2 rounded-control border border-border bg-surface p-3 font-mono text-sm break-words whitespace-pre-wrap";

/** `components` plus a `pre` that hands registered languages to `blocks`. */
function withBlocks(blocks: MarkdownBlocks): Components {
  return {
    ...components,
    pre: ({ node, children }) => {
      // A fenced block is <pre><code class="language-x">text</code></pre>.
      const code = node?.children[0];
      if (code?.type === "element" && code.tagName === "code") {
        const className = code.properties.className;
        const language = Array.isArray(className) ? /^language-(.+)$/.exec(String(className[0]))?.[1] : undefined;
        // Own keys only: "constructor" or "toString" must not reach Object.prototype.
        if (language && Object.hasOwn(blocks, language)) {
          return blocks[language](code.children.map((child) => (child.type === "text" ? child.value : "")).join(""));
        }
      }
      return <pre className={PRE_CLASS}>{children}</pre>;
    },
  };
}
```

and change the existing `pre` entry in `components` to use the constant: `pre: ({ children }) => <pre className={PRE_CLASS}>{children}</pre>,` — move `const PRE_CLASS` above `components` so it is defined first.

Change the component:

```tsx
export function Markdown({ children, blocks, className }: MarkdownProps) {
  return (
    <div className={cn("break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={blocks ? withBlocks(blocks) : components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

`index.ts`: `export type { MarkdownBlocks, MarkdownProps } from "./Markdown";`

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/atoms/Markdown`
Expected: PASS (all Markdown stories).

- [ ] **Step 5: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm typecheck`

---

### Task 5: `MatchReport` molecule

**Files:**
- Create: `apps/web/src/components/molecules/MatchReport/MatchReport.tsx`, `index.ts`, `MatchReport.stories.tsx`

**Interfaces:**
- Consumes: `type MatchBlock`, `type MatchStatus` from `@/lib/chat`; `Badge` (tones from Task 3); `Icon`.
- Produces: `MatchReport(props: MatchReportProps)`, `type MatchReportProps = MatchBlock & { className?: string }`, from `@/components/molecules/MatchReport`.

- [ ] **Step 1: Write the stories (failing: no component yet)** — `MatchReport.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { MatchReport } from "./MatchReport";

const meta = {
  title: "Molecules/MatchReport",
  component: MatchReport,
  parameters: { layout: "padded" },
  args: {
    title: "Senior Front-end Engineer · Acme",
    score: 72,
    summary: "Strong React and accessibility match; GraphQL isn't shown.",
    items: [
      { requirement: "5+ years React", status: "met", evidence: "8 years of React at Acme and Globex" },
      { requirement: "Accessibility (WCAG 2.1 AA)", status: "met", evidence: "Led the WCAG audit at Acme" },
      { requirement: "Team leadership", status: "partial", evidence: "Mentored 2 graduates", suggestion: "Say what changed for the people you mentored." },
      { requirement: "GraphQL", status: "missing", suggestion: "If you've used it, add where; if not, mention it as something you're learning." },
    ],
  },
  render: (args) => (
    <div className="max-w-xl">
      <MatchReport {...args} />
    </div>
  ),
} satisfies Meta<typeof MatchReport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Typical: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Senior Front-end Engineer · Acme" })).toBeInTheDocument();
    await expect(canvas.getByText("72% match")).toBeInTheDocument();
    await expect(canvas.getByText("2 met · 1 partly · 1 missing")).toBeInTheDocument();
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(4);
    // Status in words, not colour alone.
    await expect(items[2]).toHaveTextContent("Partly");
    await expect(items[3]).toHaveTextContent("Missing");
    await expect(items[3]).toHaveTextContent("Suggestion: If you've used it");
  },
};

export const AllMet: Story = {
  args: { score: 100, summary: undefined, items: [{ requirement: "React", status: "met", evidence: "8 years" }] },
  play: async ({ canvas }) => {
    // Zero counts are left out.
    await expect(canvas.getByText("1 met")).toBeInTheDocument();
  },
};

export const AllMissing: Story = {
  args: {
    score: 0,
    items: [
      { requirement: "Rust", status: "missing" },
      { requirement: "Embedded systems", status: "missing" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0% match")).toBeInTheDocument();
    await expect(canvas.getByText("2 missing")).toBeInTheDocument();
  },
};

/** Long text wraps at a phone's width instead of scrolling. */
export const LongText: Story = {
  args: {
    title: "Principal Platform Engineer, Developer Experience and Internal Tooling · A Very Long Company Name Pty Ltd",
    items: [{ requirement: "https://example.com/".concat("a".repeat(80)), status: "partial", evidence: "x".repeat(300) }],
  },
  render: (args) => (
    <div className="w-[320px]">
      <MatchReport {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const report = canvasElement.querySelector("article")!;
    await expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth);
  },
};
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/MatchReport`
Expected: FAIL (cannot resolve `./MatchReport`).

- [ ] **Step 3: Implement** — `MatchReport.tsx`:

```tsx
import { Badge, type BadgeProps } from "@/components/atoms/Badge";
import { Icon, type IconName } from "@/components/atoms/Icon";
import { cn } from "@/lib/cn";
import type { MatchBlock, MatchStatus } from "@/lib/chat";

export type MatchReportProps = MatchBlock & { className?: string };

const STATUS: Record<MatchStatus, { label: string; count: string; tone: NonNullable<BadgeProps["tone"]>; icon: IconName }> = {
  met: { label: "Met", count: "met", tone: "success", icon: "check-circle" },
  partial: { label: "Partly", count: "partly", tone: "warning", icon: "alert-circle" },
  missing: { label: "Missing", count: "missing", tone: "danger", icon: "x" },
};
const ORDER: MatchStatus[] = ["met", "partial", "missing"];

/**
 * How well something matches a list of requirements, e.g. a CV against a job ad: the overall score,
 * then each requirement with its status (in words and colour), the evidence for it, and a suggestion.
 * A list rather than a table, so it reads at a phone's width. Presentational.
 */
export function MatchReport({ title, score, summary, items, className }: MatchReportProps) {
  const counts = ORDER.map((status) => [status, items.filter((item) => item.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${STATUS[status].count}`)
    .join(" · ");

  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{title}</h3>
      <p className="mt-2">
        <span className="text-heading-md font-bold">{score}%</span> match
      </p>
      {/* The bar repeats the number above, so it is hidden from screen readers. An SVG attribute, not a
          style attribute: the CSP allows no inline styles. */}
      <svg aria-hidden="true" viewBox="0 0 100 2" preserveAspectRatio="none" className="mt-1 h-2 w-full overflow-hidden rounded-full">
        <rect width="100" height="2" className="fill-border" />
        <rect width={score} height="2" className="fill-action" />
      </svg>
      {summary && <p className="mt-2">{summary}</p>}
      <p className="mt-2 text-sm text-fg-muted">{counts}</p>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => {
          const status = STATUS[item.status];
          return (
            // The model's order; requirements can repeat.
            <li key={index} className="border-t border-border pt-3">
              <Badge tone={status.tone} className="gap-1">
                <Icon name={status.icon} className="size-4" />
                {status.label}
              </Badge>
              <p className="mt-1 font-semibold">{item.requirement}</p>
              {item.evidence && <p className="mt-1 text-fg-muted">{item.evidence}</p>}
              {item.suggestion && (
                <p className="mt-1">
                  <span className="font-semibold">Suggestion:</span> {item.suggestion}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
```

`IconName` is exported from `@/components/atoms/Icon` (as `Alert.tsx` uses it). `fill-border` / `fill-action` are generated by Tailwind 4 from the `--color-*` tokens, like `bg-action`; check the bar is visible in Storybook. `text-fg-muted` on `bg-surface` is AAA (Text atom: "Both tones are WCAG AAA on white").

`index.ts`:

```ts
export { MatchReport } from "./MatchReport";
export type { MatchReportProps } from "./MatchReport";
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/MatchReport`
Expected: PASS, no axe violations. Then open Storybook (`pnpm storybook` at the root, http://localhost:6006, Molecules / MatchReport) at 375px and 1280px and look at it.

- [ ] **Step 5: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck`

---

### Task 6: `ChatBubble` renders match blocks; `ChatWindow` passes `streaming`

**Files:**
- Modify: `apps/web/src/components/molecules/ChatBubble/ChatBubble.tsx`, `ChatBubble.stories.tsx`
- Modify: `apps/web/src/components/organisms/ChatWindow/ChatWindow.tsx`

**Interfaces:**
- Consumes: `Markdown` `blocks` (Task 4), `MatchReport` (Task 5), `MATCH_BLOCK`, `parseMatchBlock` (Task 1), `Skeleton` atom.
- Produces: `ChatBubbleProps.streaming?: boolean` ("this reply is still arriving").

- [ ] **Step 1: Write the failing stories** — append to `ChatBubble.stories.tsx` (before `Typing`):

```tsx
const MATCH_JSON = JSON.stringify({
  title: "Front-end Engineer · Acme",
  score: 72,
  items: [
    { requirement: "React", status: "met", evidence: "8 years" },
    { requirement: "GraphQL", status: "missing", suggestion: "Add it if you've used it." },
  ],
});

/** A ```match block in a reply renders as a match report, with the text around it. */
export const WithMatchReport: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's how you match.\n\n\`\`\`match\n${MATCH_JSON}\n\`\`\`\n\nWant me to tailor your CV?` },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Front-end Engineer · Acme" })).toBeInTheDocument();
    await expect(canvas.getByText("72% match")).toBeInTheDocument();
    await expect(canvas.getByText("Want me to tailor your CV?")).toBeInTheDocument();
  },
};

/** While the block's JSON is still arriving: a placeholder, announced politely. */
export const MatchReportStreaming: Story = {
  args: { from: "assistant", author: "CV coach", streaming: true, children: `Here's how you match.\n\n\`\`\`match\n${MATCH_JSON.slice(0, 40)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing match report…");
  },
};

/** Invalid JSON once the reply has ended (e.g. cut off by the length cap): a short note, no raw JSON. */
export const MatchReportBroken: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's how you match.\n\n\`\`\`match\n${MATCH_JSON.slice(0, 40)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This match report couldn't be shown.")).toBeInTheDocument();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/"title"/)).not.toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ChatBubble`
Expected: FAIL (no heading; the block shows as code).

- [ ] **Step 3: Implement ChatBubble** — in `ChatBubble.tsx`:

Add imports:

```tsx
import { Skeleton } from "@/components/atoms/Skeleton";
import { MatchReport } from "@/components/molecules/MatchReport";
import { MATCH_BLOCK, parseMatchBlock } from "@/lib/chat";
```

Add to `ChatBubbleProps` (after `attachments`):

```tsx
  /** The reply is still arriving: an incomplete component block shows a placeholder, not an error. */
  streaming?: boolean;
```

Add above `export function ChatBubble`:

```tsx
/**
 * A reply's ```match block. Its JSON is judged by whether it parses: an open fence runs to the end of
 * the text, so a half-received block looks like a whole one.
 */
function MatchBlockView({ code, streaming }: { code: string; streaming: boolean }) {
  const report = parseMatchBlock(code);
  if (report) return <MatchReport {...report} />;
  if (streaming) {
    return (
      <div role="status" className="my-2 space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">Preparing match report…</p>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  return <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">This match report couldn&apos;t be shown.</p>;
}
```

Destructure `streaming = false` in the `ChatBubble` signature and change the assistant branch to:

```tsx
        ) : from === "assistant" ? (
          <Markdown blocks={{ [MATCH_BLOCK]: (code) => <MatchBlockView code={code} streaming={streaming} /> }}>{children ?? ""}</Markdown>
        ) : (
```

- [ ] **Step 4: Implement ChatWindow** — in `ChatWindow.tsx`, change the messages map to pass `streaming` to the newest assistant message while a reply streams:

```tsx
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            from={message.from}
            author={message.from === "user" ? "You" : assistantName}
            attachments={message.attachments}
            streaming={streaming && message === latest && message.from === "assistant"}
          >
            {message.text}
          </ChatBubble>
        ))}
```

(`latest` is already defined: `const latest = messages.at(-1);`.)

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ChatBubble src/components/organisms/ChatWindow`
Expected: PASS, no axe violations.

- [ ] **Step 6: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck`

---

### Task 7: e2e: match report through the real page

**Files:**
- Modify: `apps/web/e2e/mock-llm.mjs`, `apps/web/e2e/chat.spec.ts`

**Interfaces:**
- Consumes: everything above, through `/chat`. Marker strings `[match]` and `[match-broken]` in the visitor's message.

- [ ] **Step 1: Write the failing e2e tests** — in `chat.spec.ts`, after the Markdown test (`"shows a Markdown reply as a list and table…"`), add:

```ts
  test("shows a match block as a match report", async ({ page }) => {
    await sendMessage(page, "How well do I fit? [match]");

    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page).getByRole("heading", { level: 3, name: "Front-end Engineer · Acme" })).toBeVisible();
    await expect(log(page)).toContainText("72% match");
    await expect(log(page)).toContainText("1 met · 1 missing");
    await expect(log(page)).toContainText("Want me to tailor your CV?");
    await expect(log(page).getByText("Preparing match report…")).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test("explains a match block it can't show", async ({ page }) => {
    await sendMessage(page, "How well do I fit? [match-broken]");

    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("This match report couldn't be shown.");
    await expect(log(page).getByText("Preparing match report…")).toHaveCount(0);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm test:e2e e2e/chat.spec.ts -g "match"`
Expected: FAIL (the mock echoes "You said: …").

- [ ] **Step 3: Implement the mock markers** — in `mock-llm.mjs`:

Extend the header comment's marker list with: `"[match]" replies with text and a match block whose JSON is split across chunks, "[match-broken]" with a match block that never completes`.

Above `const server = createServer(` add:

```js
const MATCH_JSON = JSON.stringify({
  title: "Front-end Engineer · Acme",
  score: 72,
  items: [
    { requirement: "React", status: "met", evidence: "8 years of React" },
    { requirement: "GraphQL", status: "missing", suggestion: "Add it if you've used it." },
  ],
});
const half = Math.floor(MATCH_JSON.length / 2);
const MATCH_REPLY = ["Here's how you match.\n\n```match\n", MATCH_JSON.slice(0, half), MATCH_JSON.slice(half), "\n```\n\nWant me to tailor your CV?"];
// Cut off mid-JSON, as when the reply hits the length cap.
const MATCH_BROKEN_REPLY = ["Here's how you match.\n\n```match\n", MATCH_JSON.slice(0, half)];
```

Change the `words` line (it currently ends with `: text.includes("[markdown]") ? markdown : ["You said: ", text, fileNote];`) so the markers are checked first:

```js
    const words = slow
      ? Array.from({ length: 60 }, (_, i) => `word${i} `)
      : text.includes("[match-broken]")
        ? MATCH_BROKEN_REPLY
        : text.includes("[match]")
          ? MATCH_REPLY
          : text.includes("[markdown]")
            ? markdown
            : ["You said: ", text, fileNote];
```

- [ ] **Step 4: Run to verify they pass, then the whole chat spec**

Run: `cd apps/web && pnpm test:e2e e2e/chat.spec.ts`
Expected: all pass on `mobile` and `desktop` (the e2e server now pins `CHAT_PERSONA=brighte` from Task 2, so no override is needed).

- [ ] **Step 5: Checks (no commit)**

Run (repo root): `pnpm lint && pnpm typecheck`

---

### Task 8: Verification, manual check, screenshots

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full gates** (repo root)

Run: `pnpm lint && pnpm lint:style && pnpm typecheck && pnpm --filter @brighte/web test`
Expected: all succeed (every story renders, `play` passes, no axe violations; unit tests pass).

- [ ] **Step 2: Lighthouse on `/chat`**

Run: `cd apps/web && pnpm build`, then start on a free port (`WEB_PORT=3201 pnpm start` in the background), then `WEB_PORT=3201 pnpm lighthouse`. Expected: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90 for `/chat`. Stop the server afterwards (check the port is free with `lsof -i :3201 -t`).

- [ ] **Step 3: Manual check with the career persona**

Start a dev server with the persona: `cd apps/web && CHAT_PERSONA=career WEB_PORT=3202 pnpm dev` (background; dotenv does not override the variable). Write a short sample CV and job ad as text files in the session scratchpad (a front-end engineer CV with React, accessibility and mentoring; a job ad asking for React, TypeScript, GraphQL and team leadership). In the browser (Playwright MCP) at 1280px: open `http://localhost:3202/chat`, attach both files, send "How well does my CV match this job?". Check: one or two sentences, then a match report with a score, met/partial/missing items, evidence quoting the CV and no invented skills (GraphQL must be `missing` if the CV doesn't mention it). Screenshot full page to `.playwright-mcp/match-report-desktop.png`; resize to 375×812 and screenshot `.playwright-mcp/match-report-mobile.png`. Stop the dev server.

- [ ] **Step 4: Report** to the user: what changed, check results with numbers, the screenshots, and anything that didn't work. Do not commit; ask whether to commit and open the PR (base `feat/chat-markdown` until PR #60 merges, then `gh pr edit --base main`).
