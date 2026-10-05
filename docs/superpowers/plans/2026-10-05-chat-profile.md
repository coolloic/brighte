# Chat Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The career persona reads a CV into a ` ```profile ` JSON block, rendered in the chat as a `ProfilePreview`; corrections by chat produce a full updated profile, and earlier versions collapse.

**Architecture:** Same mechanism as the match report (PR #61): a Zod schema in `src/lib/chat/`, a presentational molecule, and a block renderer registered in `ChatBubble`. `MatchBlockView` becomes a generic `BlockView`. `ChatWindow` marks every profile reply but the newest as collapsed. Provider clients, stream and history formats stay unchanged.

**Tech Stack:** Next.js 16, React 19 (React Compiler), Tailwind 4, Zod 4, react-markdown 10, Storybook 10 + Vitest (Chromium + axe), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-05-chat-profile-design.md`

## Global Constraints

- Shell: prefix commands with `export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH;` (agent shell has Node 18 and no pnpm). pnpm only.
- Branch `feat/chat-profile` (stacked on `feat/chat-match-report`, PR #61). **Never commit, push or open a PR unless the user asks**; each task ends with checks, not a commit.
- `apps/web/CLAUDE.md` rules: atomic layers, one component per folder with `index.ts` and stories, `@/` imports, role tokens only, `cn()`, `focus-visible:focus-ring`, ≥44px targets, no inline `style` attributes (CSP), AAA text contrast, 320px without horizontal scroll.
- Inside `src/lib/chat/`, import siblings directly (`./profile-block`), never the barrel. `index.ts` stays browser-safe.
- Zod runs jitless (`z.config({ jitless: true })` in `match-block.ts`, loaded first by the `@/lib/chat` barrel). Do not move it.
- Never-invent: the profile copies what the CV says; no rewording at this stage.
- Numbers: career `maxOutputTokens` 8192 (`maxMessageChars` stays 8000); name 1–120; headline ≤160; email ≤200; phone ≤60; location parts ≤100; links ≤10 (label 1–60, url 1–500); summaries/descriptions ≤2000; highlights ≤600 each, ≤20; skills ≤60 each, ≤40 per role/project; work ≤30; education ≤15; skill groups ≤20 (group ≤60, keywords 1–60 of ≤60 chars); certificates ≤30 (name ≤200); projects ≤20; languages ≤15; employer/position/institution/qualification/field/location ≤160; grade ≤60.
- Dates `/^\d{4}(-(0[1-9]|1[0-2]))?$/`; work `end` may also be `"present"`. Display: "2019", "Mar 2019", "Present", ranges "Mar 2021 – Present", start only "From 2019", end only "Until 2020".
- URLs: no scheme → prefix `https://`; any scheme other than `http`/`https` fails the profile.
- Copy: placeholder "Preparing your profile…"; failure "This profile couldn't be shown. It may have been cut off: ask me to try again."; collapsed summary "Earlier version of your profile"; suggestions "Read my CV into a profile", "How well does my CV match this job?", "Which skills should I highlight?".
- Definition of done (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck`; `pnpm --filter @brighte/web test`; `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts`; Lighthouse `/chat` ≥ 90/95/90/90.

## Review Focus

- A CV whose links section contains `javascript:alert(1)` (or the model writes one): expect the profile to fail validation, never a clickable `javascript:` link. Pinned in Task 1.
- A model writes `"linkedin.com/in/jane"` without a scheme: expect a working `https://linkedin.com/in/jane` link, not a relative link to our site. Pinned in Task 1.
- A model writes `""` for an optional field (`"headline": ""`): expect it to render as absent (no empty line or stray " · "). Pinned in Task 3.
- Two profile replies, then a third message that has no profile: expect the second profile to stay expanded (newest *profile*, not newest message). Pinned in Task 5.
- A model writes the month as a word (`"2019-Mar"`) or a full date (`"2019-03-01"`): expect the profile to fail with the failure note rather than show a wrong date. Pinned in Task 1.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/chat/profile-block.ts` (+ test) | Create | `profile` block schema, types, `parseProfileBlock` |
| `apps/web/src/lib/chat/blocks.ts` (+ test) | Create | `hasBlock(text, language)` |
| `apps/web/src/lib/chat/index.ts` | Modify | Export the above |
| `apps/web/src/lib/chat/personas.ts` (+ test) | Modify | Career prompt, suggestions, 8192 cap |
| `apps/web/src/components/molecules/ProfilePreview/*` | Create | The profile card |
| `apps/web/src/components/molecules/ChatBubble/*` | Modify | Generic `BlockView`, profile block, `collapseProfile` |
| `apps/web/src/components/organisms/ChatWindow/*` | Modify | Collapse every profile but the newest |
| `apps/web/e2e/mock-llm.mjs`, `chat.spec.ts`, `security.spec.ts` | Modify | `[profile]` / `[profile-broken]` |

---

### Task 1: Profile schema and `hasBlock`

**Files:**
- Create: `apps/web/src/lib/chat/profile-block.ts`, `apps/web/src/lib/chat/profile-block.test.ts`
- Create: `apps/web/src/lib/chat/blocks.ts`, `apps/web/src/lib/chat/blocks.test.ts`
- Modify: `apps/web/src/lib/chat/index.ts`

**Interfaces:**
- Produces (from `@/lib/chat`): `PROFILE_BLOCK: "profile"`, `profileBlockSchema`, `type Profile`, `type ProfileRole = NonNullable<Profile["work"]>[number]`, `parseProfileBlock(code: string): Profile | undefined`, `hasBlock(text: string, language: string): boolean`.

- [ ] **Step 1: Write the failing tests** — `apps/web/src/lib/chat/profile-block.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseProfileBlock } from "./profile-block";

const full = {
  basics: {
    name: "Jane Citizen",
    headline: "Front-end Engineer",
    email: "jane@example.com",
    phone: "0412 345 678",
    location: { city: "Sydney", region: "NSW", country: "Australia" },
    links: [{ label: "GitHub", url: "https://github.com/jane" }],
    summary: "Front-end engineer with 8 years of React.",
  },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      location: "Sydney",
      start: "2021-03",
      end: "present",
      highlights: ["Led the React rebuild of the loan portal."],
      skills: ["React", "TypeScript"],
    },
    { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021" },
  ],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ group: "Front-end", keywords: ["React", "TypeScript"] }],
  certificates: [{ name: "AWS Cloud Practitioner", issuer: "AWS", date: "2022-05" }],
  projects: [{ name: "a11y-lint", description: "Lint rules for accessible JSX.", url: "https://github.com/jane/a11y-lint" }],
  languages: [{ language: "English", fluency: "Native" }],
};
const parse = (value: unknown) => parseProfileBlock(JSON.stringify(value));
const withRole = (role: object) => parse({ basics: { name: "Jane" }, work: [{ employer: "Acme", position: "Engineer", ...role }] });
const withLink = (url: string) => parse({ basics: { name: "Jane", links: [{ label: "Site", url }] } });

describe("parseProfileBlock", () => {
  it("accepts a full profile", () => {
    expect(parse(full)).toEqual(full);
  });

  it("accepts a profile with only a name", () => {
    expect(parse({ basics: { name: "Jane Citizen" } })).toEqual({ basics: { name: "Jane Citizen" } });
  });

  it("drops nulls and unknown fields", () => {
    const profile = parse({ basics: { name: "Jane", headline: null, nickname: "J" }, work: null, hobbies: ["chess"] });
    expect(profile).toEqual({ basics: { name: "Jane" } });
  });

  it.each(["2019", "2019-03", "2019-12"])("accepts the date %j", (start) => {
    expect(withRole({ start })?.work?.[0].start).toBe(start);
  });

  it("accepts a current role", () => {
    expect(withRole({ start: "2021", end: "present" })?.work?.[0].end).toBe("present");
  });

  it.each(["March 2019", "2019-3", "2019-13", "2019-Mar", "2019-03-01", "19"])("rejects the date %j", (start) => {
    expect(withRole({ start })).toBeUndefined();
  });

  it("adds https:// to a link without a scheme", () => {
    expect(withLink("linkedin.com/in/jane")?.basics.links?.[0].url).toBe("https://linkedin.com/in/jane");
  });

  it.each(["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,hi", "mailto:jane@example.com"])("rejects the link %j", (url) => {
    expect(withLink(url)).toBeUndefined();
  });

  it.each([
    ["a missing name", { basics: {} }],
    ["no basics", { work: [] }],
    ["a role without an employer", { basics: { name: "Jane" }, work: [{ position: "Engineer" }] }],
    ["31 roles", { basics: { name: "Jane" }, work: Array.from({ length: 31 }, () => ({ employer: "Acme", position: "Engineer" })) }],
    ["a 601-character highlight", { basics: { name: "Jane" }, work: [{ employer: "Acme", position: "Engineer", highlights: ["a".repeat(601)] }] }],
    ["a skill group with no keywords", { basics: { name: "Jane" }, skills: [{ group: "Front-end", keywords: [] }] }],
  ])("rejects %s", (_, profile) => {
    expect(parse(profile)).toBeUndefined();
  });

  it.each(["", "{", '{"basics": {"name": "Ja', "not json"])("returns undefined for incomplete or invalid JSON: %j", (code) => {
    expect(parseProfileBlock(code)).toBeUndefined();
  });
});
```

`apps/web/src/lib/chat/blocks.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { hasBlock } from "./blocks";

describe("hasBlock", () => {
  it("finds a fence line in the language", () => {
    expect(hasBlock("Here's your profile.\n\n```profile\n{}\n```", "profile")).toBe(true);
  });

  it("finds a fence that is still open (streaming)", () => {
    expect(hasBlock("Here's your profile.\n\n```profile\n{", "profile")).toBe(true);
  });

  it.each([
    ["another language", "```profile-x\n{}\n```"],
    ["the word in prose", "I'll build your profile next."],
    ["a fence that isn't on its own line", "Use ```profile blocks."],
    ["no fence", "Hello"],
  ])("ignores %s", (_, text) => {
    expect(hasBlock(text, "profile")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/profile-block.test.ts src/lib/chat/blocks.test.ts`
Expected: FAIL, cannot resolve `./profile-block` and `./blocks`.

- [ ] **Step 3: Implement** — `apps/web/src/lib/chat/profile-block.ts`

```ts
import { z } from "zod";

// A "profile" block: a reply's fenced code block (```profile) holding a CV as structured JSON (a
// subset of JSON Resume, plus skills per role), shown in the chat as a profile preview. It copies
// what the CV says, and is what tailoring and templates build on later. The schema checks what the
// model wrote and, as JSON Schema, teaches the model the format (the career persona's prompt).

/** The code block language that marks a profile block. */
export const PROFILE_BLOCK = "profile";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);
/** Optional; null (which models often write for "none") counts as left out. */
const optional = <T extends z.ZodType>(schema: T) =>
  schema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional();
const list = <T extends z.ZodType>(item: T, max: number) => optional(z.array(item).max(max));
const strings = (maxLength: number, maxItems: number) => list(required(maxLength), maxItems);

/** "2019" or "2019-03": as precise as the CV gives it. */
const date = z
  .string()
  .trim()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/);

/**
 * A web address from the CV (which the visitor controls): one without a scheme gets https://, and only
 * http(s) is allowed, so a profile can never carry a javascript: or data: link.
 */
const url = required(500)
  .transform((value) => (/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`))
  .refine((value) => /^https?:\/\//i.test(value), "Only http and https links");

export const profileBlockSchema = z.object({
  basics: z.object({
    name: required(120),
    headline: optional(text(160)),
    email: optional(text(200)),
    phone: optional(text(60)),
    location: optional(z.object({ city: optional(text(100)), region: optional(text(100)), country: optional(text(100)) })),
    links: list(z.object({ label: required(60), url }), 10),
    summary: optional(text(2000)),
  }),
  work: list(
    z.object({
      employer: required(160),
      position: required(160),
      location: optional(text(160)),
      start: optional(date),
      /** "present" for a current role; left out when the CV doesn't say. */
      end: optional(z.union([date, z.literal("present")])),
      summary: optional(text(2000)),
      highlights: strings(600, 20),
      /** The skills the CV mentions for this role. */
      skills: strings(60, 40),
    }),
    30,
  ),
  education: list(
    z.object({
      institution: required(160),
      qualification: optional(text(160)),
      field: optional(text(160)),
      start: optional(date),
      end: optional(date),
      grade: optional(text(60)),
    }),
    15,
  ),
  skills: list(z.object({ group: optional(text(60)), keywords: z.array(required(60)).min(1).max(60) }), 20),
  certificates: list(z.object({ name: required(200), issuer: optional(text(160)), date: optional(date) }), 30),
  projects: list(
    z.object({
      name: required(160),
      description: optional(text(2000)),
      highlights: strings(600, 20),
      skills: strings(60, 40),
      url: optional(url),
    }),
    20,
  ),
  languages: list(z.object({ language: required(60), fluency: optional(text(60)) }), 15),
});

export type Profile = z.infer<typeof profileBlockSchema>;
export type ProfileRole = NonNullable<Profile["work"]>[number];

/** The block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseProfileBlock(code: string): Profile | undefined {
  let json: unknown;
  try {
    json = JSON.parse(code);
  } catch {
    return undefined;
  }
  const result = profileBlockSchema.safeParse(json);
  return result.success ? result.data : undefined;
}
```

`apps/web/src/lib/chat/blocks.ts`

```ts
/** True when the text has a fenced code block in this language: a line that is exactly ```language. */
export function hasBlock(text: string, language: string): boolean {
  const fence = "```" + language;
  return text.split("\n").some((line) => line.trim() === fence);
}
```

Append to `apps/web/src/lib/chat/index.ts`:

```ts
export { hasBlock } from "./blocks";
export { PROFILE_BLOCK, parseProfileBlock, profileBlockSchema, type Profile, type ProfileRole } from "./profile-block";
```

Note: `toEqual(full)` in the test passes because the parsed profile keeps every field and `undefined` keys from the transforms are ignored by `toEqual`. If `"drops nulls and unknown fields"` fails because `work: null` leaves `work: undefined` as a key, `toEqual` still treats it as absent; do not change the schema for it.

- [ ] **Step 4: Run to verify they pass**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/profile-block.test.ts src/lib/chat/blocks.test.ts`
Expected: PASS.

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm typecheck`.

---

### Task 2: Career persona reads CVs into profiles

**Files:**
- Modify: `apps/web/src/lib/chat/personas.ts`, `apps/web/src/lib/chat/personas.test.ts`

**Interfaces:**
- Consumes: `PROFILE_BLOCK`, `profileBlockSchema` from `./profile-block` (Task 1).
- Produces: career persona with `maxOutputTokens: 8192` and the new suggestions.

- [ ] **Step 1: Update the tests** — in `personas.test.ts`:
  - change the `it.each` row `["career", 8000, 4096],` to `["career", 8000, 8192],` and its comment to `// A pasted job ad is long, and a profile is long JSON.`
  - in `"lets the env override a persona's limits"`, change the expected `maxOutputTokens: 4096` to `maxOutputTokens: 8192`
  - add:

```ts
  it("teaches the career persona the profile block and the extraction rules", () => {
    const { system, suggestions } = getPersona("career");
    expect(system).toContain("```profile");
    // The JSON Schema, generated from profileBlockSchema.
    expect(system).toContain('"employer"');
    expect(system).toContain('"present"');
    expect(system).toMatch(/copy what the CV says/i);
    expect(system).toMatch(/full updated profile/i);
    expect(suggestions).toEqual(["Read my CV into a profile", "How well does my CV match this job?", "Which skills should I highlight?"]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/personas.test.ts`
Expected: FAIL (4096 vs 8192; no ```profile in the prompt; old suggestions).

- [ ] **Step 3: Implement** — in `personas.ts`:

Add to imports: `import { PROFILE_BLOCK, profileBlockSchema } from "./profile-block";`

Add after `MATCH_EXAMPLE`:

```ts
const PROFILE_EXAMPLE = {
  basics: { name: "Jane Citizen", headline: "Front-end Engineer", email: "jane@example.com", location: { city: "Sydney", region: "NSW" } },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      start: "2021-03",
      end: "present",
      highlights: ["Led the React and TypeScript rebuild of the customer loan portal."],
      skills: ["React", "TypeScript"],
    },
  ],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ group: "Front-end", keywords: ["React", "TypeScript", "Next.js"] }],
};
```

In `career`: set `suggestions: ["Read my CV into a profile", "How well does my CV match this job?", "Which skills should I highlight?"],` and `maxOutputTokens: 8192,`. In the `system` template, replace the last paragraph

```
If the CV or the job description is missing, ask for it. Replies are shown as Markdown: use lists and bold text where they help. Write in Australian English.`,
```

with

```
When the visitor asks you to read their CV or build their profile, or attaches a CV without saying what they want, write one sentence, then their profile as a fenced code block with the language "${PROFILE_BLOCK}" holding only JSON in this format (JSON Schema):

${JSON.stringify(z.toJSONSchema(profileBlockSchema, { io: "input" }))}

- Copy what the CV says: don't reword, summarise or improve it (tailoring comes later), and leave out anything it doesn't state.
- Dates: "YYYY" or "YYYY-MM", exactly as precise as the CV ("2019" stays "2019"). end: "present" only when the CV says the role is current; leave end out when it doesn't say.
- skills on a role or project: the skills the CV mentions for it.
- When the visitor corrects the profile, say what you changed in one short sentence, then write the full updated profile block again, never only the part that changed.

Example:

\`\`\`${PROFILE_BLOCK}
${JSON.stringify(PROFILE_EXAMPLE, null, 2)}
\`\`\`

If you need the CV or the job description and it's missing, ask for it. Replies are shown as Markdown: use lists and bold text where they help. Write in Australian English.`,
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat`
Expected: PASS (all chat unit tests).

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm typecheck`. Also update `.env.example`'s line `# own (brighte and general 1000 / 1024; career 8000 / 4096, for pasted job ads and match reports).` to `# own (brighte and general 1000 / 1024; career 8000 / 8192, for pasted job ads, match reports and profiles).`

---

### Task 3: `ProfilePreview` molecule

**Files:**
- Create: `apps/web/src/components/molecules/ProfilePreview/ProfilePreview.tsx`, `index.ts`, `ProfilePreview.stories.tsx`

**Interfaces:**
- Consumes: `type Profile` from `@/lib/chat` (Task 1); `Badge` (`tone="neutral"`).
- Produces: `ProfilePreview(props: ProfilePreviewProps)`, `type ProfilePreviewProps = Profile & { className?: string }`.

- [ ] **Step 1: Write the stories** — `ProfilePreview.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ProfilePreview } from "./ProfilePreview";

const meta = {
  title: "Molecules/ProfilePreview",
  component: ProfilePreview,
  parameters: { layout: "padded" },
  args: {
    basics: {
      name: "Jane Citizen",
      headline: "Front-end Engineer",
      email: "jane@example.com",
      phone: "0412 345 678",
      location: { city: "Sydney", region: "NSW" },
      links: [
        { label: "GitHub", url: "https://github.com/jane" },
        { label: "LinkedIn", url: "https://linkedin.com/in/jane" },
      ],
      summary: "Front-end engineer with 8 years building accessible React applications.",
    },
    work: [
      {
        employer: "Acme Lending",
        position: "Senior Front-end Engineer",
        location: "Sydney",
        start: "2021-03",
        end: "present",
        highlights: ["Led the React + TypeScript rebuild of the customer loan portal.", "Ran the WCAG 2.1 AA audit."],
        skills: ["React", "TypeScript", "axe"],
      },
      { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021", skills: ["React", "Redux"] },
    ],
    education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
    skills: [
      { group: "Front-end", keywords: ["React", "TypeScript", "Next.js"] },
      { keywords: ["Jest", "Cypress"] },
    ],
    certificates: [{ name: "AWS Cloud Practitioner", issuer: "AWS", date: "2022-05" }],
    projects: [{ name: "a11y-lint", description: "Lint rules for accessible JSX.", url: "https://github.com/jane/a11y-lint", skills: ["ESLint"] }],
    languages: [{ language: "English", fluency: "Native" }, { language: "Mandarin" }],
  },
  render: (args) => (
    <div className="max-w-xl">
      <ProfilePreview {...args} />
    </div>
  ),
} satisfies Meta<typeof ProfilePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.getByText("Sydney, NSW · jane@example.com · 0412 345 678")).toBeInTheDocument();
    for (const section of ["Summary", "Experience", "Education", "Skills", "Certificates", "Projects", "Languages"]) {
      await expect(canvas.getByRole("heading", { level: 4, name: section })).toBeInTheDocument();
    }
    await expect(canvas.getByText("Senior Front-end Engineer · Acme Lending")).toBeInTheDocument();
    await expect(canvas.getByText("Sydney · Mar 2021 – Present")).toBeInTheDocument();
    await expect(canvas.getByText("2017 – 2021")).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Skills at Acme Lending" })).toHaveTextContent("axe");
    await expect(canvas.getByText("BSc, Computer Science · University of Sydney")).toBeInTheDocument();
    await expect(canvas.getByText("Until 2016")).toBeInTheDocument();
    await expect(canvas.getByText("AWS Cloud Practitioner · AWS · May 2022")).toBeInTheDocument();
    await expect(canvas.getByText("English (Native), Mandarin")).toBeInTheDocument();
    const github = canvas.getByRole("link", { name: "GitHub (opens in a new tab)" });
    await expect(github).toHaveAttribute("href", "https://github.com/jane");
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("rel", "noopener noreferrer");
  },
};

/** Only a name: no empty sections, no stray separators. */
export const NameOnly: Story = {
  args: { basics: { name: "Jane Citizen", headline: "", email: "" }, work: undefined, education: undefined, skills: undefined, certificates: undefined, projects: undefined, languages: undefined },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
    await expect(canvasElement.textContent).not.toContain("·");
  },
};

/** Dates as precise as the CV: a year alone, and a start with no end. */
export const YearOnlyDates: Story = {
  args: { work: [{ employer: "Initech", position: "Developer", start: "2019" }], education: undefined, certificates: undefined, projects: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("From 2019")).toBeInTheDocument();
  },
};

/** Long text wraps at a phone's width. */
export const LongText: Story = {
  args: {
    basics: { name: "Jane Citizen", email: "a.very.long.email.address.for.testing.wrapping@example-company-with-long-domain.com.au" },
    work: [{ employer: "A Very Long Employer Name Pty Ltd", position: "Principal Engineer", highlights: ["x".repeat(400)] }],
  },
  render: (args) => (
    <div className="w-[320px]">
      <ProfilePreview {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("article")!;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ProfilePreview`
Expected: FAIL (cannot resolve `./ProfilePreview`).

- [ ] **Step 3: Implement** — `ProfilePreview.tsx`

```tsx
import type { ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import type { Profile } from "@/lib/chat";
import { cn } from "@/lib/cn";

export type ProfilePreviewProps = Profile & { className?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2019" stays "2019", "2019-03" is "Mar 2019", "present" is "Present". */
function formatDate(date: string) {
  if (date === "present") return "Present";
  const [year, month] = date.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

function dateRange(start?: string, end?: string) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return end === "present" ? "Present" : `Until ${formatDate(end)}`;
  return undefined;
}

/** The parts that are there (empty strings from the model count as absent), joined with " · ". */
const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

const link = "text-fg-brand underline underline-offset-2 focus-visible:focus-ring";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-border pt-3">
      <h4 className="font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function SkillBadges({ skills, label }: { skills?: string[]; label: string }) {
  if (!skills?.length) return null;
  return (
    <ul aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {skills.map((skill, index) => (
        <li key={index}>
          <Badge tone="neutral">{skill}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Highlights({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function NewTabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={link} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * A CV as a structured profile: contact details, then each section the CV has (experience with
 * dates, highlights and skills per role; education; skills; certificates; projects; languages).
 * Empty sections are left out. Presentational: the data was checked by profileBlockSchema.
 */
export function ProfilePreview({ basics, work, education, skills, certificates, projects, languages, className }: ProfilePreviewProps) {
  const location = [basics.location?.city, basics.location?.region, basics.location?.country].filter(Boolean).join(", ");
  const contact = join([location, basics.email, basics.phone]);

  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{basics.name}</h3>
      {basics.headline && <p className="mt-1">{basics.headline}</p>}
      {contact && <p className="mt-1 text-sm text-fg-muted">{contact}</p>}
      {basics.links?.length ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {basics.links.map((item, index) => (
            <li key={index}>
              <NewTabLink href={item.url}>{item.label}</NewTabLink>
            </li>
          ))}
        </ul>
      ) : null}

      {basics.summary && (
        <Section title="Summary">
          <p className="mt-1">{basics.summary}</p>
        </Section>
      )}

      {work?.length ? (
        <Section title="Experience">
          <ul className="mt-1 space-y-3">
            {work.map((role, index) => {
              const details = join([role.location, dateRange(role.start, role.end)]);
              return (
                <li key={index}>
                  <p className="font-semibold">
                    {role.position} · {role.employer}
                  </p>
                  {details && <p className="text-sm text-fg-muted">{details}</p>}
                  {role.summary && <p className="mt-1">{role.summary}</p>}
                  <Highlights items={role.highlights} />
                  <SkillBadges skills={role.skills} label={`Skills at ${role.employer}`} />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {education?.length ? (
        <Section title="Education">
          <ul className="mt-1 space-y-2">
            {education.map((item, index) => {
              const title = [item.qualification, item.field].filter(Boolean).join(", ");
              const details = join([dateRange(item.start, item.end), item.grade]);
              return (
                <li key={index}>
                  <p className="font-semibold">{title ? `${title} · ${item.institution}` : item.institution}</p>
                  {details && <p className="text-sm text-fg-muted">{details}</p>}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {skills?.length ? (
        <Section title="Skills">
          <ul className="mt-1 space-y-1">
            {skills.map((group, index) => (
              <li key={index}>
                {group.group ? <span className="font-semibold">{group.group}: </span> : null}
                {group.keywords.join(", ")}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {certificates?.length ? (
        <Section title="Certificates">
          <ul className="mt-1 space-y-1">
            {certificates.map((item, index) => (
              <li key={index}>{join([item.name, item.issuer, item.date && formatDate(item.date)])}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {projects?.length ? (
        <Section title="Projects">
          <ul className="mt-1 space-y-3">
            {projects.map((project, index) => (
              <li key={index}>
                <p className="font-semibold">{project.url ? <NewTabLink href={project.url}>{project.name}</NewTabLink> : project.name}</p>
                {project.description && <p className="mt-1">{project.description}</p>}
                <Highlights items={project.highlights} />
                <SkillBadges skills={project.skills} label={`Skills in ${project.name}`} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {languages?.length ? (
        <Section title="Languages">
          <p className="mt-1">{languages.map((item) => (item.fluency ? `${item.language} (${item.fluency})` : item.language)).join(", ")}</p>
        </Section>
      ) : null}
    </article>
  );
}
```

`index.ts`:

```ts
export { ProfilePreview } from "./ProfilePreview";
export type { ProfilePreviewProps } from "./ProfilePreview";
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ProfilePreview`
Expected: PASS, no axe violations.

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm lint:style && pnpm typecheck`.

---

### Task 4: `ChatBubble`: generic `BlockView`, profile blocks, `collapseProfile`

**Files:**
- Modify: `apps/web/src/components/molecules/ChatBubble/ChatBubble.tsx`, `ChatBubble.stories.tsx`

**Interfaces:**
- Consumes: `PROFILE_BLOCK`, `parseProfileBlock`, `type Profile`, `type MatchBlock` from `@/lib/chat`; `ProfilePreview` (Task 3).
- Produces: `ChatBubbleProps.collapseProfile?: boolean` ("an earlier profile: show it collapsed").

- [ ] **Step 1: Write the failing stories** — append before `Typing` in `ChatBubble.stories.tsx` (add `import { useState } from "react";` and `userEvent` to the `storybook/test` import):

```tsx
const PROFILE_JSON = JSON.stringify({
  basics: { name: "Jane Citizen", headline: "Front-end Engineer" },
  work: [{ employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021-03", end: "present" }],
});
const PROFILE_REPLY = `Here's your profile.\n\n\`\`\`profile\n${PROFILE_JSON}\n\`\`\``;

/** A ```profile block renders as a profile preview. */
export const WithProfile: Story = {
  args: { from: "assistant", author: "CV coach", children: PROFILE_REPLY },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.getByText("Mar 2021 – Present")).toBeInTheDocument();
  },
};

/** An earlier profile in the conversation: collapsed behind a summary (opening it is checked in e2e). */
export const ProfileCollapsed: Story = {
  args: { from: "assistant", author: "CV coach", children: PROFILE_REPLY, collapseProfile: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Earlier version of your profile")).toBeInTheDocument();
    await expect(canvasElement.querySelector("details")).not.toHaveAttribute("open");
    // Inside a closed <details>: present but not shown (jest-dom's toBeVisible knows closed details).
    await expect(canvas.getByText("Jane Citizen")).not.toBeVisible();
  },
};

export const ProfileStreaming: Story = {
  args: { from: "assistant", author: "CV coach", streaming: true, children: `Here's your profile.\n\n\`\`\`profile\n${PROFILE_JSON.slice(0, 30)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing your profile…");
  },
};

export const ProfileBroken: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's your profile.\n\n\`\`\`profile\n${PROFILE_JSON.slice(0, 30)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This profile couldn't be shown. It may have been cut off: ask me to try again.")).toBeInTheDocument();
  },
};

/** While a reply streams, its blocks stay mounted as text is added (selection, live regions). */
export const BlocksStayMounted: Story = {
  render: function Render() {
    const [extra, setExtra] = useState("");
    return (
      <div className="mx-auto w-full max-w-xl">
        <button type="button" onClick={() => setExtra((text) => `${text} more`)}>
          Add text
        </button>
        <ChatBubble from="assistant" author="CV coach" streaming>
          {`${PROFILE_REPLY}\n\nAnything to fix${extra}`}
        </ChatBubble>
      </div>
    );
  },
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector("article");
    await userEvent.click(canvas.getByRole("button", { name: "Add text" }));
    await expect(canvas.getByText("Anything to fix more")).toBeInTheDocument();
    await expect(canvasElement.querySelector("article")).toBe(card);
  },
};
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ChatBubble`
Expected: FAIL (the profile shows as code; `collapseProfile` is not a prop — the type error shows in typecheck, the stories fail on the missing heading/summary/status).

- [ ] **Step 3: Implement** — in `ChatBubble.tsx`:

Change imports:

```tsx
import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { FileChip, type FileChipProps } from "@/components/atoms/FileChip";
import { Icon } from "@/components/atoms/Icon";
import { Markdown, type MarkdownBlocks } from "@/components/atoms/Markdown";
import { Skeleton } from "@/components/atoms/Skeleton";
import { MatchReport } from "@/components/molecules/MatchReport";
import { ProfilePreview } from "@/components/molecules/ProfilePreview";
import { MATCH_BLOCK, parseMatchBlock, parseProfileBlock, PROFILE_BLOCK, type MatchBlock, type Profile } from "@/lib/chat";
import { cn } from "@/lib/cn";
```

Add to `ChatBubbleProps` after `streaming`:

```tsx
  /** An earlier profile in the conversation (a newer one follows): its profile block shows collapsed. */
  collapseProfile?: boolean;
```

Replace `MatchBlockView`, `BLOCKS` and `STREAMING_BLOCKS` with:

```tsx
/** How a component block shows: its parser, its component, and what to say while it streams or when it fails. */
type BlockSpec<T> = {
  parse: (code: string) => T | undefined;
  render: (value: T) => ReactNode;
  preparing: string;
  /** Usually a reply cut off by the length cap: the stream ends normally, so nothing else says so. */
  failed: string;
};

const MATCH: BlockSpec<MatchBlock> = {
  parse: parseMatchBlock,
  render: (report) => <MatchReport {...report} />,
  preparing: "Preparing match report…",
  failed: "This match report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer requirements.",
};

const PROFILE: BlockSpec<Profile> = {
  parse: parseProfileBlock,
  render: (profile) => <ProfilePreview {...profile} />,
  preparing: "Preparing your profile…",
  failed: "This profile couldn't be shown. It may have been cut off: ask me to try again.",
};

/**
 * A reply's component block. Its JSON is judged by whether it parses: an open fence runs to the end
 * of the text, so a half-received block looks like a whole one.
 */
function BlockView<T>({ code, streaming, spec }: { code: string; streaming: boolean; spec: BlockSpec<T> }) {
  const value = spec.parse(code);
  if (value !== undefined) return spec.render(value);
  if (streaming) {
    return (
      <div role="status" className="my-2 space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">{spec.preparing}</p>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  return <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">{spec.failed}</p>;
}

function blocks(streaming: boolean, collapseProfile: boolean): MarkdownBlocks {
  return {
    [MATCH_BLOCK]: (code) => <BlockView code={code} streaming={streaming} spec={MATCH} />,
    [PROFILE_BLOCK]: (code) =>
      collapseProfile ? (
        <details className="my-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-control border border-border bg-surface px-3 text-sm font-semibold focus-visible:focus-ring">
            Earlier version of your profile
          </summary>
          <BlockView code={code} streaming={streaming} spec={PROFILE} />
        </details>
      ) : (
        <BlockView code={code} streaming={streaming} spec={PROFILE} />
      ),
  };
}

// Module-level, so Markdown keeps reply blocks mounted while a reply streams in (a new object each
// render would remount them on every chunk). A bubble switches map once: when its reply ends, or when
// a newer profile collapses its own. A streaming reply is the newest, so it is never collapsed.
const BLOCKS = blocks(false, false);
const STREAMING_BLOCKS = blocks(true, false);
const COLLAPSED_BLOCKS = blocks(false, true);
```

Change the signature to destructure `collapseProfile = false`, and the Markdown line to:

```tsx
          <Markdown blocks={streaming ? STREAMING_BLOCKS : collapseProfile ? COLLAPSED_BLOCKS : BLOCKS}>{children ?? ""}</Markdown>
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ChatBubble`
Expected: PASS (all ChatBubble stories, including the match ones), no axe violations.

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm lint:style && pnpm typecheck`.

---

### Task 5: `ChatWindow` collapses every profile but the newest

**Files:**
- Modify: `apps/web/src/components/organisms/ChatWindow/ChatWindow.tsx`, `ChatWindow.stories.tsx`

**Interfaces:**
- Consumes: `hasBlock`, `PROFILE_BLOCK` (Task 1); `ChatBubble` `collapseProfile` (Task 4).

- [ ] **Step 1: Write the failing story** — append to `ChatWindow.stories.tsx`:

```tsx
const profileReply = (name: string) => `Here's your profile.\n\n\`\`\`profile\n${JSON.stringify({ basics: { name } })}\n\`\`\``;

/** Corrections give new profiles: only the newest is open; a later message without one doesn't change that. */
export const ProfileVersions: Story = {
  args: {
    assistantName: "CV coach",
    messages: [
      { id: "1", from: "user", text: "Read my CV into a profile" },
      { id: "2", from: "assistant", text: profileReply("Jane Citizn") },
      { id: "3", from: "user", text: "My surname is spelt Citizen" },
      { id: "4", from: "assistant", text: profileReply("Jane Citizen") },
      { id: "5", from: "user", text: "Thanks" },
      { id: "6", from: "assistant", text: "You're welcome!" },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByText("Earlier version of your profile")).toHaveLength(1);
    await expect(canvasElement.querySelectorAll("details:not([open])")).toHaveLength(1);
    await expect(canvas.getByText("Jane Citizen")).toBeVisible();
    await expect(canvas.getByText("Jane Citizn")).not.toBeVisible();
  },
};
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/organisms/ChatWindow`
Expected: FAIL (no "Earlier version of your profile"; both profiles expanded).

- [ ] **Step 3: Implement** — in `ChatWindow.tsx`:

Add `import { hasBlock, PROFILE_BLOCK } from "@/lib/chat";` (keep the existing `@/lib/llm` import).

After `const latest = messages.at(-1);` add:

```tsx
  // Corrections give new profiles: only the newest stays open, earlier ones collapse.
  const latestProfileId = messages.findLast((message) => message.from === "assistant" && hasBlock(message.text, PROFILE_BLOCK))?.id;
```

Add the prop on `ChatBubble` (after `streaming={…}`):

```tsx
            collapseProfile={message.from === "assistant" && message.id !== latestProfileId && hasBlock(message.text, PROFILE_BLOCK)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project storybook src/components/organisms/ChatWindow src/components/molecules/ChatBubble`
Expected: PASS.

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm typecheck`.

---

### Task 6: e2e: profiles through the real page

**Files:**
- Modify: `apps/web/e2e/mock-llm.mjs`, `apps/web/e2e/chat.spec.ts`, `apps/web/e2e/security.spec.ts`

- [ ] **Step 1: Write the failing tests** — in `chat.spec.ts`, after `"explains a match block it can't show"` add:

```ts
  test("shows a profile, and collapses the earlier one after a correction", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page).getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeVisible();
    await expect(log(page)).toContainText("Mar 2021 – Present");

    await sendMessage(page, "My Globex role ended in 2020 [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    const earlier = log(page).getByText("Earlier version of your profile");
    await expect(earlier).toHaveCount(1);
    // Both replies hold a profile; only the newest is shown until the earlier one is opened.
    const shownProfiles = log(page).locator("h3", { hasText: "Jane Citizen" }).filter({ visible: true });
    await expect(shownProfiles).toHaveCount(1);
    // A real click opens the earlier version.
    await earlier.click();
    await expect(shownProfiles).toHaveCount(2);
    await expectNoA11yViolations(page);
  });

  test("explains a profile it can't show", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile-broken]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("This profile couldn't be shown. It may have been cut off: ask me to try again.");
    await expect(log(page).getByText("Preparing your profile…")).toHaveCount(0);
  });
```

In `security.spec.ts`, in `"the CSP blocks nothing in the chat, including a match report"`, rename it to `"the CSP blocks nothing in the chat, including a match report and a profile"` and add before the final `expect(await violations(page))…`:

```ts
  await page.getByRole("textbox", { name: "Message" }).fill("Read my CV into a profile [profile]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeVisible();
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts -g "profile"`
Expected: FAIL (the mock echoes "You said: …").

- [ ] **Step 3: Implement the mock** — in `mock-llm.mjs`:

Extend the header comment with: `"[profile]" replies with a profile block split across chunks, "[profile-broken]" with one that never completes.`

After `MATCH_BROKEN_REPLY` add:

```js
const PROFILE_JSON = JSON.stringify({
  basics: { name: "Jane Citizen", headline: "Front-end Engineer", email: "jane@example.com" },
  work: [
    { employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021-03", end: "present", skills: ["React", "TypeScript"] },
    { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021" },
  ],
});
const profileHalf = Math.floor(PROFILE_JSON.length / 2);
const PROFILE_REPLY = ["Here's your profile.\n\n```profile\n", PROFILE_JSON.slice(0, profileHalf), PROFILE_JSON.slice(profileHalf), "\n```"];
const PROFILE_BROKEN_REPLY = ["Here's your profile.\n\n```profile\n", PROFILE_JSON.slice(0, profileHalf)];
```

Move the `markdown` array out of the request handler to module level as `const MARKDOWN_REPLY = [...]` (same contents), and replace the `words` expression with an ordered marker table (longer markers first, so `[match-broken]` wins over `[match]`):

```js
// Checked in order: a marker that contains another comes first.
const MARKER_REPLIES = [
  ["[match-broken]", MATCH_BROKEN_REPLY],
  ["[match]", MATCH_REPLY],
  ["[profile-broken]", PROFILE_BROKEN_REPLY],
  ["[profile]", PROFILE_REPLY],
  ["[markdown]", MARKDOWN_REPLY],
];
```

(module level), and in the handler:

```js
    const marked = MARKER_REPLIES.find(([marker]) => text.includes(marker));
    const words = slow ? Array.from({ length: 60 }, (_, i) => `word${i} `) : marked ? marked[1] : ["You said: ", text, fileNote];
```

- [ ] **Step 4: Run to verify they pass, then both specs**

Run: `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts`
Expected: all pass (mobile and desktop).

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm typecheck`.

---

### Task 7: Verification, manual check, screenshots

- [ ] **Step 1: Full gates** (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck && pnpm --filter @brighte/web test` — all pass.
- [ ] **Step 2: Lighthouse:** `cd apps/web && pnpm build`, `WEB_PORT=3201 pnpm start` (background), `WEB_PORT=3201 pnpm lighthouse`; `/chat` ≥ 90/95/90/90 and the assertions pass. Stop the server (`lsof -i :3201 -t` empty).
- [ ] **Step 3: Manual:** `CHAT_PERSONA=career WEB_PORT=3202 pnpm start` (background; the build from Step 2). In the browser (Playwright MCP) at 1280px: open `http://localhost:3202/chat`, attach `.playwright-mcp/jane-citizen-cv.txt` (copy it from the scratchpad if missing: the sample CV used for project 1), click "Read my CV into a profile". Check the preview matches the CV (Acme "2021 – Present", Globex "2017 – 2021", BSc 2016, skills groups) and nothing is invented. Then send "My Globex role ended in 2020" and check: one sentence naming the change, a new full profile with Globex "2017 – 2020", the earlier one collapsed. Screenshot full page `.playwright-mcp/profile-desktop.png`; at 375×812 `.playwright-mcp/profile-mobile.png`. Stop the server.
- [ ] **Step 4: Report** to the user with check results, screenshots and anything that didn't work. Do not commit; ask whether to commit and open the PR (base `feat/chat-match-report` until PR #61 merges, then `main`).
