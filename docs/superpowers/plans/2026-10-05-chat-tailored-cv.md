# Chat Tailored CV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The career persona writes a ` ```tailored ` block that references profile entries by index; `tailorCv` merges it with the newest valid profile into a CV, lists what was left out and each bullet's original, and flags anything new; `TailoredCv` shows it in the chat.

**Architecture:** Same block mechanism as PRs #61/#62. A pure `tailorCv(profile, block)` in `src/lib/chat/tailor.ts` carries the never-invent guarantee. `ChatBubble` moves from per-combination block maps to one module-level map plus a per-bubble `BlockContext` (streaming, collapsed block types, reference profile). `ChatWindow` finds the newest valid profile and the newest profile/tailored replies.

**Tech Stack:** Next.js 16, React 19 (React Compiler), Tailwind 4, Zod 4, react-markdown 10, Storybook 10 + Vitest (Chromium + axe), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-05-chat-tailored-cv-design.md`

## Global Constraints

- Shell: prefix commands with `export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH;`. pnpm only. Never commit, push or open a PR unless the user asks; tasks end with checks.
- Branch `feat/chat-tailored-cv` (stacked on `feat/chat-profile`, PR #62).
- `apps/web/CLAUDE.md` rules (atomic layers, barrels, stories, `@/` imports, role tokens, `cn()`, focus ring, ≥44px targets, no inline `style`, AAA contrast, 320px). Inside `src/lib/chat/` import siblings directly.
- Never invent: facts (employer, title, dates, institution, qualification, certificate, language) come only from the profile.
- Copy (exact):
  - Header `Tailored for {title} · {employer}` (just `Tailored for {title}` without employer).
  - Flags box title `{N} thing to check` / `{N} things to check`; blocking group heading `Fix before downloading`; warnings heading `Worth a look`.
  - Flag messages: `A role that isn't in your profile (number {i+1}) was skipped.`; same pattern for `project`, `education entry`, `certificate`, `language`; `"{text}" cites a bullet that isn't in your profile.`; `This bullet isn't based on anything in your profile: "{text}"`; `Not in your profile: {skill}`; `New number {n} in "{text}" (not in the original).`; `New number {n} in the {headline|summary} (not in your profile).`
  - Review summary `Review changes: {R} reworded · {L} left out`; headings `Reworded`, `Left out`; `Original:` prefix.
  - Placeholder `Preparing your tailored CV…`; failure `This tailored CV couldn't be shown. It may have been cut off: ask me to try again.`; no profile `This tailored CV needs your profile: ask me to read your CV first.`; collapsed `Earlier version of your tailored CV`.
  - Suggestions `Read my CV into a profile`, `How well does my CV match this job?`, `Tailor my CV for this job`.
- Numbers: tailored block limits — job.title 1–160, employer ≤160, headline ≤160, summary ≤2000, bullet text 1–600, `from` ≤10 indexes, work ≤30, projects ≤20, skills groups ≤20 (group ≤60, keywords 1–60 of 1–60 chars), education ≤15, certificates ≤30, languages ≤15, ≤20 bullets per role/project. Indexes are integers ≥ 0.
- Definition of done (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck`; `pnpm --filter @brighte/web test`; `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts`; Lighthouse `/chat` ≥ 90/95/90/90.

## Review Focus

- The model writes the same role twice, or references a role but lists no bullets: expect the role shown (with no bullets in the second case) and its bullets listed as left out, no crash. Pinned in Task 2.
- A skill the profile mentions only inside a bullet ("WCAG"): expect no "Not in your profile" flag; a short skill that is only part of a word ("Go" vs "Google"): expect the flag. Pinned in Task 2.
- The profile is corrected after tailoring and the referenced role disappears: expect a blocking "isn't in your profile" flag on the old tailored CV, not a crash or a silently wrong role. Pinned in Task 2 (re-check) and Task 6.
- A tailored block while no valid profile exists (only a broken one): expect the "needs your profile" note. Pinned in Task 5.
- Versions: two profiles and two tailored CVs interleaved: expect exactly the newest of each open. Pinned in Task 6.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/chat/block-schema.ts` | Create | Shared schema helpers and `parseJsonBlock` |
| `apps/web/src/lib/chat/profile-block.ts` | Modify | Use the shared helpers (no behaviour change) |
| `apps/web/src/lib/chat/tailored-block.ts` (+ test) | Create | `tailored` block schema |
| `apps/web/src/lib/chat/blocks.ts` (+ test) | Modify | `blockContents(text, language)` |
| `apps/web/src/lib/chat/tailor.ts` (+ test) | Create | `tailorCv` |
| `apps/web/src/lib/chat/index.ts` | Modify | Exports |
| `apps/web/src/lib/chat/personas.ts` (+ test) | Modify | Tailoring prompt, suggestions |
| `apps/web/src/components/molecules/TailoredCv/*` | Create | The tailored CV view |
| `apps/web/src/components/molecules/ChatBubble/*` | Modify | `BlockContext`, one block map, tailored view, `collapse`, `referenceProfile` |
| `apps/web/src/components/organisms/ChatWindow/*` | Modify | Reference profile, newest profile/tailored |
| `apps/web/e2e/mock-llm.mjs`, `chat.spec.ts`, `security.spec.ts` | Modify | `[tailored]`, `[tailored-broken]` |

---

### Task 1: Shared schema helpers, `tailored` schema, `blockContents`

**Files:**
- Create: `apps/web/src/lib/chat/block-schema.ts`, `apps/web/src/lib/chat/tailored-block.ts`, `apps/web/src/lib/chat/tailored-block.test.ts`
- Modify: `apps/web/src/lib/chat/profile-block.ts`, `apps/web/src/lib/chat/blocks.ts`, `apps/web/src/lib/chat/blocks.test.ts`, `apps/web/src/lib/chat/index.ts`

**Interfaces:**
- Produces (from `@/lib/chat`): `TAILORED_BLOCK: "tailored"`, `tailoredBlockSchema`, `type TailoredBlock`, `type TailoredBullet = NonNullable<NonNullable<TailoredBlock["work"]>[number]["highlights"]>[number]`, `parseTailoredBlock(code): TailoredBlock | undefined`, `blockContents(text: string, language: string): string[]`.
- Internal: `block-schema.ts` exports `text`, `required`, `optional`, `list`, `strings`, `parseJsonBlock<T>(code: string, schema: z.ZodType<T>): T | undefined` (JSON.parse → strip blanks → safeParse).

- [ ] **Step 1: Write the failing tests** — `tailored-block.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseTailoredBlock } from "./tailored-block";

const valid = {
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  headline: "Senior Front-end Engineer · React and accessibility",
  summary: "Eight years of React.",
  work: [{ role: 0, highlights: [{ text: "Led the React rebuild.", from: [0] }] }],
  projects: [{ project: 0 }],
  skills: [{ group: "Front-end", keywords: ["React"] }],
  education: [0],
  certificates: [0],
  languages: [0],
};
const parse = (value: unknown) => parseTailoredBlock(JSON.stringify(value));

describe("parseTailoredBlock", () => {
  it("accepts a valid block", () => {
    expect(parse(valid)).toEqual(valid);
  });

  it("accepts a block with only the job", () => {
    expect(parse({ job: { title: "Engineer" } })).toEqual({ job: { title: "Engineer" } });
  });

  it("drops nulls, blanks and unknown fields", () => {
    expect(parse({ job: { title: "Engineer", employer: "" }, headline: null, extra: 1 })).toEqual({ job: { title: "Engineer" } });
  });

  it.each([
    ["no job title", { job: {} }],
    ["no job", { headline: "x" }],
    ["a negative role index", { ...valid, work: [{ role: -1 }] }],
    ["a decimal role index", { ...valid, work: [{ role: 1.5 }] }],
    ["a string index", { ...valid, education: ["0"] }],
    ["a negative source index", { ...valid, work: [{ role: 0, highlights: [{ text: "x", from: [-1] }] }] }],
    ["an empty bullet", { ...valid, work: [{ role: 0, highlights: [{ text: "" , from: [0] }] }] }],
    ["31 roles", { ...valid, work: Array.from({ length: 31 }, () => ({ role: 0 })) }],
  ])("rejects %s", (_, block) => {
    expect(parse(block)).toBeUndefined();
  });

  it.each(["", "{", '{"job": {"title": "Eng', "nope"])("returns undefined for incomplete or invalid JSON: %j", (code) => {
    expect(parseTailoredBlock(code)).toBeUndefined();
  });
});
```

Note on "an empty bullet": blank strings are stripped before parsing, so `text: ""` becomes a missing required field and the block fails. That is intended: a bullet with no text is not a bullet.

Append to `blocks.test.ts`:

```ts
describe("blockContents", () => {
  it("returns each block's contents, closed or still open", () => {
    const text = "Intro\n\n```profile\n{\"a\":1}\n```\n\nMiddle\n\n```profile\n{\"b\":";
    expect(blockContents(text, "profile")).toEqual(['{"a":1}', '{"b":']);
  });

  it("ignores other languages", () => {
    expect(blockContents("```match\n{}\n```", "profile")).toEqual([]);
  });
});
```

and change its import to `import { blockContents, hasBlock } from "./blocks";`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/tailored-block.test.ts src/lib/chat/blocks.test.ts`
Expected: FAIL (no `./tailored-block`; `blockContents` not exported).

- [ ] **Step 3: Implement**

`block-schema.ts` (move the helpers out of `profile-block.ts`):

```ts
import { z } from "zod";

// Shared by the component blocks' schemas (profile, tailored): trimmed strings, optional fields where
// null counts as left out, capped lists, and parsing that treats blank strings as left out.

export const text = (max: number) => z.string().trim().max(max);
export const required = (max: number) => text(max).min(1);
/** Optional; null (which models often write for "none") counts as left out. */
export const optional = <T extends z.ZodType>(schema: T) =>
  schema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional();
export const list = <T extends z.ZodType>(item: T, max: number) => optional(z.array(item).max(max));
export const strings = (maxLength: number, maxItems: number) => list(required(maxLength), maxItems);

/**
 * The JSON with blank strings removed (as values and as list items): models write "" for "unknown",
 * which should leave a field out, not fail the block. Done before parsing, not in the schema, so the
 * JSON Schema the model is taught stays exact.
 */
function withoutBlanks(value: unknown): unknown {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (Array.isArray(value)) return value.map(withoutBlanks).filter((item) => item !== undefined);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutBlanks(item)]));
  return value;
}

/** A block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseJsonBlock<T>(code: string, schema: z.ZodType<T>): T | undefined {
  let json: unknown;
  try {
    json = JSON.parse(code);
  } catch {
    return undefined;
  }
  const result = schema.safeParse(withoutBlanks(json));
  return result.success ? result.data : undefined;
}
```

In `profile-block.ts`: delete its local `text`, `required`, `optional`, `list`, `strings`, `withoutBlanks` and the body of `parseProfileBlock`; import `{ list, optional, parseJsonBlock, required, strings, text } from "./block-schema"`; and make

```ts
/** The block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseProfileBlock(code: string): Profile | undefined {
  return parseJsonBlock(code, profileBlockSchema);
}
```

(If `z.ZodType<T>` rejects the schema type because input and output differ, type the parameter as `z.ZodType<T, unknown>`, i.e. `schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }`. Ledger whichever you use.)

`tailored-block.ts`:

```ts
import { z } from "zod";
import { list, optional, parseJsonBlock, required, text } from "./block-schema";

// A "tailored" block: a reply's fenced code block (```tailored) holding a CV tailored to one job, as
// references into the newest profile (by 0-based index) plus new wording. It never restates facts:
// tailorCv (./tailor) takes employers, titles and dates from the profile itself.

/** The code block language that marks a tailored CV. */
export const TAILORED_BLOCK = "tailored";

const index = z.number().int().min(0);
const bullet = z.object({
  text: required(600),
  /** 0-based indexes of the profile bullets (of the same role or project) this one rewords. */
  from: list(index, 10),
});
const bullets = list(bullet, 20);

export const tailoredBlockSchema = z.object({
  job: z.object({ title: required(160), employer: optional(text(160)) }),
  headline: optional(text(160)),
  summary: optional(text(2000)),
  work: list(z.object({ role: index, highlights: bullets }), 30),
  projects: list(z.object({ project: index, highlights: bullets }), 20),
  skills: list(z.object({ group: optional(text(60)), keywords: z.array(required(60)).min(1).max(60) }), 20),
  education: list(index, 15),
  certificates: list(index, 30),
  languages: list(index, 15),
});

export type TailoredBlock = z.infer<typeof tailoredBlockSchema>;
export type TailoredBullet = z.infer<typeof bullet>;

/** The block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseTailoredBlock(code: string): TailoredBlock | undefined {
  return parseJsonBlock(code, tailoredBlockSchema);
}
```

Append to `blocks.ts`:

```ts
/** The contents of each fenced code block in this language, in order. A block still open (streaming) runs to the end. */
export function blockContents(text: string, language: string): string[] {
  const fence = "```" + language;
  const contents: string[] = [];
  let current: string[] | undefined;
  for (const line of text.split("\n")) {
    if (current === undefined) {
      if (line.trim() === fence) current = [];
    } else if (line.trim() === "```") {
      contents.push(current.join("\n"));
      current = undefined;
    } else {
      current.push(line);
    }
  }
  if (current !== undefined) contents.push(current.join("\n"));
  return contents;
}
```

Append to `index.ts`:

```ts
export { blockContents } from "./blocks";
export { parseTailoredBlock, TAILORED_BLOCK, tailoredBlockSchema, type TailoredBlock, type TailoredBullet } from "./tailored-block";
```

(Change the existing `export { hasBlock } from "./blocks";` to `export { blockContents, hasBlock } from "./blocks";` instead of adding a second line for `./blocks`.)

- [ ] **Step 4: Run to verify they pass**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat`
Expected: PASS (new tests, and the profile tests unchanged after the refactor).

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm typecheck`.

---

### Task 2: `tailorCv`

**Files:**
- Create: `apps/web/src/lib/chat/tailor.ts`, `apps/web/src/lib/chat/tailor.test.ts`
- Modify: `apps/web/src/lib/chat/index.ts`

**Interfaces:**
- Consumes: `type Profile` (profile-block), `type TailoredBlock` (Task 1).
- Produces (from `@/lib/chat`):
  - `tailorCv(profile: Profile, block: TailoredBlock): TailorResult`
  - `type TailorFlag = { level: "blocking" | "warning"; message: string }`
  - `type RewordedBullet = { where: string; text: string; originals: string[] }`
  - `type LeftOut = { roles: string[]; bullets: { where: string; text: string }[]; projects: string[]; education: string[]; certificates: string[]; languages: string[] }`
  - `type TailorResult = { cv: Profile; flags: TailorFlag[]; reworded: RewordedBullet[]; leftOut: LeftOut }`
  - Labels: role `"{position} · {employer}"`; project `name`; education `"{qualification, field} · {institution}"` or `institution`; certificate `name`; language `language`.

- [ ] **Step 1: Write the failing tests** — `tailor.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { Profile } from "./profile-block";
import { tailorCv } from "./tailor";
import type { TailoredBlock } from "./tailored-block";

const profile: Profile = {
  basics: { name: "Jane Citizen", headline: "Front-end Engineer", email: "jane@example.com", summary: "8 years of React." },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      start: "2021",
      end: "present",
      highlights: ["Led the React rebuild of the loan portal (40,000 monthly users).", "Ran the WCAG 2.1 AA audit.", "Mentored 2 graduate engineers."],
      skills: ["React", "TypeScript"],
    },
    { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021", highlights: ["Built quote forms in React and Redux."] },
  ],
  projects: [{ name: "a11y-lint", highlights: ["Lint rules for accessible JSX."] }],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ keywords: ["React", "TypeScript", "Next.js", "Jest"] }],
  certificates: [{ name: "AWS Cloud Practitioner" }],
  languages: [{ language: "English" }, { language: "Mandarin" }],
};
const job = { title: "Senior Front-end Engineer", employer: "Brightpath" };
const tailor = (block: Omit<TailoredBlock, "job">, from: Profile = profile) => tailorCv(from, { job, ...block });
const messages = (result: ReturnType<typeof tailorCv>, level: "blocking" | "warning") =>
  result.flags.filter((flag) => flag.level === level).map((flag) => flag.message);

describe("tailorCv: merging", () => {
  it("replaces the headline and summary, keeping name and contact details", () => {
    const { cv } = tailor({ headline: "Senior Front-end Engineer · React", summary: "React engineer with 8 years." });
    expect(cv.basics).toEqual({ ...profile.basics, headline: "Senior Front-end Engineer · React", summary: "React engineer with 8 years." });
  });

  it("keeps the profile's headline and summary when the block has none", () => {
    expect(tailor({}).cv.basics).toEqual(profile.basics);
  });

  it("takes roles in the block's order, with every fact from the profile and the block's bullets", () => {
    const { cv } = tailor({
      work: [
        { role: 1, highlights: [{ text: "Built React quote forms.", from: [0] }] },
        { role: 0, highlights: [{ text: "Ran the WCAG 2.1 AA audit.", from: [1] }] },
      ],
    });
    expect(cv.work).toEqual([
      { ...profile.work![1], highlights: ["Built React quote forms."] },
      { ...profile.work![0], highlights: ["Ran the WCAG 2.1 AA audit."] },
    ]);
  });

  it("shows a referenced role with no bullets, and lists its bullets as left out", () => {
    const result = tailor({ work: [{ role: 1 }] });
    expect(result.cv.work).toEqual([{ ...profile.work![1], highlights: undefined }]);
    expect(result.leftOut.bullets).toEqual([{ where: "Front-end Engineer · Globex Insurance", text: "Built quote forms in React and Redux." }]);
  });

  it("allows the same role twice", () => {
    expect(tailor({ work: [{ role: 0 }, { role: 0 }] }).cv.work).toHaveLength(2);
  });

  it("picks education, certificates and languages by index, in the block's order", () => {
    const { cv } = tailor({ education: [0], certificates: [0], languages: [1, 0] });
    expect(cv.education).toEqual(profile.education);
    expect(cv.certificates).toEqual(profile.certificates);
    expect(cv.languages).toEqual([{ language: "Mandarin" }, { language: "English" }]);
  });

  it("uses the block's skills, and none when it has none", () => {
    expect(tailor({ skills: [{ group: "Front-end", keywords: ["React"] }] }).cv.skills).toEqual([{ group: "Front-end", keywords: ["React"] }]);
    expect(tailor({}).cv.skills).toBeUndefined();
  });
});

describe("tailorCv: left out and originals", () => {
  it("lists every unreferenced entry and uncited bullet", () => {
    const { leftOut } = tailor({ work: [{ role: 0, highlights: [{ text: "Led the React rebuild.", from: [0] }] }], languages: [0] });
    expect(leftOut).toEqual({
      roles: ["Front-end Engineer · Globex Insurance"],
      bullets: [
        { where: "Senior Front-end Engineer · Acme Lending", text: "Ran the WCAG 2.1 AA audit." },
        { where: "Senior Front-end Engineer · Acme Lending", text: "Mentored 2 graduate engineers." },
      ],
      projects: ["a11y-lint"],
      education: ["BSc, Computer Science · University of Sydney"],
      certificates: ["AWS Cloud Practitioner"],
      languages: ["Mandarin"],
    });
  });

  it("lists nothing when everything is used", () => {
    const { leftOut } = tailor({
      work: [
        { role: 0, highlights: [{ text: "a", from: [0, 1, 2] }] },
        { role: 1, highlights: [{ text: "b", from: [0] }] },
      ],
      projects: [{ project: 0, highlights: [{ text: "c", from: [0] }] }],
      education: [0],
      certificates: [0],
      languages: [0, 1],
    });
    expect(leftOut).toEqual({ roles: [], bullets: [], projects: [], education: [], certificates: [], languages: [] });
  });

  it("gives each bullet the exact profile text it rewords", () => {
    const { reworded } = tailor({ work: [{ role: 0, highlights: [{ text: "Led the React rebuild and the accessibility audit.", from: [0, 1] }] }] });
    expect(reworded).toEqual([
      {
        where: "Senior Front-end Engineer · Acme Lending",
        text: "Led the React rebuild and the accessibility audit.",
        originals: ["Led the React rebuild of the loan portal (40,000 monthly users).", "Ran the WCAG 2.1 AA audit."],
      },
    ]);
  });
});

describe("tailorCv: blocking flags", () => {
  it.each([
    ["role", { work: [{ role: 5 }] }, "A role that isn't in your profile (number 6) was skipped."],
    ["project", { projects: [{ project: 3 }] }, "A project that isn't in your profile (number 4) was skipped."],
    ["education entry", { education: [2] }, "An education entry that isn't in your profile (number 3) was skipped."],
    ["certificate", { certificates: [1] }, "A certificate that isn't in your profile (number 2) was skipped."],
    ["language", { languages: [9] }, "A language that isn't in your profile (number 10) was skipped."],
  ])("skips and flags a %s that doesn't exist", (_, block, message) => {
    const result = tailor(block);
    expect(messages(result, "blocking")).toEqual([message]);
  });

  it("flags a bullet citing a profile bullet that doesn't exist", () => {
    const result = tailor({ work: [{ role: 1, highlights: [{ text: "Built React forms.", from: [0, 4] }] }] });
    expect(messages(result, "blocking")).toEqual(['"Built React forms." cites a bullet that isn\'t in your profile.']);
    expect(result.reworded[0].originals).toEqual(["Built quote forms in React and Redux."]);
  });

  it.each([undefined, []])("flags a bullet with no source (from: %j)", (from) => {
    const result = tailor({ work: [{ role: 0, highlights: [{ text: "Led a team of 10.", from }] }] });
    expect(messages(result, "blocking")).toEqual(['This bullet isn\'t based on anything in your profile: "Led a team of 10."']);
  });
});

describe("tailorCv: warnings", () => {
  it("flags a skill that isn't in the profile", () => {
    expect(messages(tailor({ skills: [{ keywords: ["React", "GraphQL"] }] }), "warning")).toEqual(["Not in your profile: GraphQL"]);
  });

  it.each(["next.js", "NEXTJS", "Next JS", "typescript"])("doesn't flag %j: same skill, different case or punctuation", (skill) => {
    expect(messages(tailor({ skills: [{ keywords: [skill] }] }), "warning")).toEqual([]);
  });

  it("doesn't flag a skill the profile mentions only inside a bullet", () => {
    expect(messages(tailor({ skills: [{ keywords: ["WCAG"] }] }), "warning")).toEqual([]);
  });

  it("flags a short skill that is only part of a word in the profile", () => {
    expect(messages(tailor({ skills: [{ keywords: ["Go"] }] }, { ...profile, basics: { ...profile.basics, summary: "Worked at Google." } }), "warning")).toEqual([
      "Not in your profile: Go",
    ]);
  });

  it("flags a number that isn't in the bullet's originals", () => {
    expect(messages(tailor({ work: [{ role: 0, highlights: [{ text: "Mentored 10 graduate engineers.", from: [2] }] }] }), "warning")).toEqual([
      'New number 10 in "Mentored 10 graduate engineers." (not in the original).',
    ]);
  });

  it("doesn't flag numbers that are in the originals, with or without separators", () => {
    expect(messages(tailor({ work: [{ role: 0, highlights: [{ text: "Rebuilt a portal for 40000 users (WCAG 2.1).", from: [0, 1] }] }] }), "warning")).toEqual([]);
  });

  it("flags a summary or headline number that is nowhere in the profile", () => {
    expect(messages(tailor({ headline: "Engineer with 12 years", summary: "8 years of React." }), "warning")).toEqual([
      "New number 12 in the headline (not in your profile).",
    ]);
  });
});

describe("tailorCv: re-check", () => {
  it("flags a role the corrected profile no longer has", () => {
    const corrected: Profile = { ...profile, work: [profile.work![0]] };
    const block = { work: [{ role: 1 }] };
    expect(messages(tailor(block), "blocking")).toEqual([]);
    expect(messages(tailor(block, corrected), "blocking")).toEqual(["A role that isn't in your profile (number 2) was skipped."]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/tailor.test.ts`
Expected: FAIL (no `./tailor`).

- [ ] **Step 3: Implement** — `tailor.ts`

```ts
import type { Profile } from "./profile-block";
import type { TailoredBlock, TailoredBullet } from "./tailored-block";

// Merges a tailored block with the profile it references, and checks it: facts (employers, titles,
// dates, degrees...) come only from the profile; everything new is flagged. Blocking flags (broken
// references, claims with no source) stop the PDF download (project 4); warnings are for the visitor.

export type TailorFlag = { level: "blocking" | "warning"; message: string };
export type RewordedBullet = { where: string; text: string; originals: string[] };
export type LeftOut = {
  roles: string[];
  bullets: { where: string; text: string }[];
  projects: string[];
  education: string[];
  certificates: string[];
  languages: string[];
};
export type TailorResult = { cv: Profile; flags: TailorFlag[]; reworded: RewordedBullet[]; leftOut: LeftOut };

type Role = NonNullable<Profile["work"]>[number];
type Project = NonNullable<Profile["projects"]>[number];
type Education = NonNullable<Profile["education"]>[number];

const roleLabel = (role: Role) => `${role.position} · ${role.employer}`;
const educationLabel = (item: Education) => {
  const title = [item.qualification, item.field].filter(Boolean).join(", ");
  return title ? `${title} · ${item.institution}` : item.institution;
};

/** Numbers in a text, without thousands separators: "40,000" and "40000" are the same; "2.1" stays. */
const numbers = (text: string) => (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
/** For comparing skills: case, spaces and punctuation don't count ("Next.js" = "nextjs"). */
const normalise = (skill: string) => skill.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every string in the profile, joined: for skills mentioned only in prose, and for numbers. */
function profileText(profile: Profile): string {
  const strings: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(profile);
  return strings.join("\n");
}

export function tailorCv(profile: Profile, block: TailoredBlock): TailorResult {
  const flags: TailorFlag[] = [];
  const reworded: RewordedBullet[] = [];
  const leftOut: LeftOut = { roles: [], bullets: [], projects: [], education: [], certificates: [], languages: [] };
  const text = profileText(profile);
  const profileNumbers = new Set(numbers(text));

  const missing = (kind: string, index: number) =>
    flags.push({ level: "blocking", message: `${/^[aeiou]/.test(kind) ? "An" : "A"} ${kind} that isn't in your profile (number ${index + 1}) was skipped.` });

  /** The block's bullets for one profile entry: their texts, with originals and flags recorded. */
  function tailorBullets(where: string, sources: string[] = [], bullets: TailoredBullet[] = [], cited: Set<number>) {
    return bullets.map((bullet) => {
      const from = bullet.from ?? [];
      if (from.length === 0) {
        flags.push({ level: "blocking", message: `This bullet isn't based on anything in your profile: "${bullet.text}"` });
      }
      const originals: string[] = [];
      let broken = false;
      for (const index of from) {
        const source = sources[index];
        if (source === undefined) broken = true;
        else {
          originals.push(source);
          cited.add(index);
        }
      }
      if (broken) flags.push({ level: "blocking", message: `"${bullet.text}" cites a bullet that isn't in your profile.` });
      if (originals.length > 0) {
        const known = new Set(originals.flatMap(numbers));
        for (const n of new Set(numbers(bullet.text))) {
          if (!known.has(n)) flags.push({ level: "warning", message: `New number ${n} in "${bullet.text}" (not in the original).` });
        }
      }
      reworded.push({ where, text: bullet.text, originals });
      return bullet.text;
    });
  }

  /** Entries picked by index: in the block's order; missing ones flagged; unpicked ones left out. */
  function pick<T>(entries: T[] = [], indexes: number[] = [], kind: string, label: (entry: T) => string, out: string[]): T[] {
    const picked: T[] = [];
    for (const index of indexes) {
      const entry = entries[index];
      if (entry === undefined) missing(kind, index);
      else picked.push(entry);
    }
    entries.forEach((entry, index) => {
      if (!indexes.includes(index)) out.push(label(entry));
    });
    return picked;
  }

  const roles = profile.work ?? [];
  const work: Role[] = [];
  const usedRoles = new Set<number>();
  const citedByRole = new Map<number, Set<number>>();
  for (const item of block.work ?? []) {
    const role = roles[item.role];
    if (!role) {
      missing("role", item.role);
      continue;
    }
    usedRoles.add(item.role);
    const cited = citedByRole.get(item.role) ?? new Set<number>();
    citedByRole.set(item.role, cited);
    const texts = tailorBullets(roleLabel(role), role.highlights, item.highlights, cited);
    work.push({ ...role, highlights: texts.length ? texts : undefined });
  }
  roles.forEach((role, index) => {
    if (!usedRoles.has(index)) leftOut.roles.push(roleLabel(role));
    else (role.highlights ?? []).forEach((bullet, i) => !citedByRole.get(index)!.has(i) && leftOut.bullets.push({ where: roleLabel(role), text: bullet }));
  });

  const allProjects = profile.projects ?? [];
  const projects: Project[] = [];
  const usedProjects = new Set<number>();
  const citedByProject = new Map<number, Set<number>>();
  for (const item of block.projects ?? []) {
    const project = allProjects[item.project];
    if (!project) {
      missing("project", item.project);
      continue;
    }
    usedProjects.add(item.project);
    const cited = citedByProject.get(item.project) ?? new Set<number>();
    citedByProject.set(item.project, cited);
    const texts = tailorBullets(project.name, project.highlights, item.highlights, cited);
    projects.push({ ...project, highlights: texts.length ? texts : undefined });
  }
  allProjects.forEach((project, index) => {
    if (!usedProjects.has(index)) leftOut.projects.push(project.name);
    else (project.highlights ?? []).forEach((bullet, i) => !citedByProject.get(index)!.has(i) && leftOut.bullets.push({ where: project.name, text: bullet }));
  });

  const education = pick(profile.education, block.education, "education entry", educationLabel, leftOut.education);
  const certificates = pick(profile.certificates, block.certificates, "certificate", (c) => c.name, leftOut.certificates);
  const languages = pick(profile.languages, block.languages, "language", (l) => l.language, leftOut.languages);

  const knownSkills = new Set([...(profile.skills ?? []).flatMap((g) => g.keywords), ...roles.flatMap((r) => r.skills ?? []), ...allProjects.flatMap((p) => p.skills ?? [])].map(normalise));
  for (const keyword of (block.skills ?? []).flatMap((group) => group.keywords)) {
    const asWord = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(keyword)}($|[^\\p{L}\\p{N}])`, "iu");
    if (!knownSkills.has(normalise(keyword)) && !asWord.test(text)) flags.push({ level: "warning", message: `Not in your profile: ${keyword}` });
  }

  for (const field of ["headline", "summary"] as const) {
    for (const n of new Set(numbers(block[field] ?? ""))) {
      if (!profileNumbers.has(n)) flags.push({ level: "warning", message: `New number ${n} in the ${field} (not in your profile).` });
    }
  }

  const cv: Profile = {
    basics: { ...profile.basics, headline: block.headline ?? profile.basics.headline, summary: block.summary ?? profile.basics.summary },
    work: block.work ? work : undefined,
    projects: block.projects ? projects : undefined,
    skills: block.skills,
    education: block.education ? education : undefined,
    certificates: block.certificates ? certificates : undefined,
    languages: block.languages ? languages : undefined,
  };
  // Blocking first, as the view lists them.
  flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "blocking" ? -1 : 1));
  return { cv, flags, reworded, leftOut };
}
```

Notes for the implementer:
- `merging` tests compare `cv.work` with `toEqual`; `highlights: undefined` equals an absent key.
- The "keeps headline and summary" test expects `cv.basics` to equal the profile's: the spread keeps `undefined` keys out when the block has no headline because `block.headline ?? profile.basics.headline` returns the profile's value.
- `numbers` strips a trailing `.` so "2." at a sentence end matches "2".

Append to `index.ts`: `export { tailorCv, type LeftOut, type RewordedBullet, type TailorFlag, type TailorResult } from "./tailor";`

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/tailor.test.ts`
Expected: PASS. If a case fails, debug the function (systematic-debugging), not the test, unless the test contradicts the spec — then ledger a ruling.

- [ ] **Step 5: Checks (no commit)** — repo root: `pnpm lint && pnpm typecheck`.

---

### Task 3: Career persona tailors

**Files:**
- Modify: `apps/web/src/lib/chat/personas.ts`, `apps/web/src/lib/chat/personas.test.ts`

- [ ] **Step 1: Update the test** — in `"teaches the career persona the profile block and the extraction rules"` change the suggestions expectation to `["Read my CV into a profile", "How well does my CV match this job?", "Tailor my CV for this job"]`, and add:

```ts
  it("teaches the career persona to tailor by reference, profile first", () => {
    const { system } = getPersona("career");
    expect(system).toContain("```tailored");
    expect(system).toContain('"from"');
    expect(system).toMatch(/build the profile first/i);
    expect(system).toMatch(/never restate/i);
    expect(system).toMatch(/0-based/i);
  });
```

- [ ] **Step 2: Run to verify it fails** — `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/personas.test.ts` → FAIL.

- [ ] **Step 3: Implement** — in `personas.ts`: import `{ TAILORED_BLOCK, tailoredBlockSchema } from "./tailored-block"`; set career `suggestions` to the three above; add

```ts
const TAILORED_EXAMPLE = {
  job: { title: "Senior Front-end Engineer", employer: "Brightpath Fintech" },
  headline: "Senior Front-end Engineer · React, TypeScript and accessibility",
  work: [
    {
      role: 0,
      highlights: [
        { text: "Led the React and TypeScript rebuild of the customer loan portal.", from: [0] },
        { text: "Ran the WCAG 2.1 AA audit and set up automated accessibility checks.", from: [1] },
      ],
    },
  ],
  skills: [{ keywords: ["React", "TypeScript", "Next.js"] }],
  education: [0],
};
```

and insert before the final paragraph (`If you need the CV or the job description and it's missing…`):

```
When the visitor asks you to tailor their CV for a job: if there is no profile in the conversation yet, build the profile first, ask them to check it, and tailor on their next message; if there is no job description, ask for it. Otherwise write one sentence, then the tailored CV as a fenced code block with the language "${TAILORED_BLOCK}" holding only JSON in this format (JSON Schema):

${JSON.stringify(z.toJSONSchema(tailoredBlockSchema, { io: "input" }))}

- It refers to the newest profile by 0-based index (role 0 is the profile's first role) and never restates facts: employers, job titles, dates, degrees, certificates and languages come from the profile.
- You may rewrite the headline and summary for the job using only facts in the profile; reorder roles, projects and bullets; reword bullets with the job ad's terms; and leave out bullets, roles or entries that don't help for this job.
- Every bullet lists "from": the 0-based indexes of the profile bullets (of the same role or project) it rewords. Never add a bullet that isn't based on the profile, a skill the profile doesn't have, or a number the original doesn't have. Use the job ad's name for a skill only when the profile has that skill.
- When the visitor asks for changes, say what you changed in one short sentence, then write the full updated tailored block again.

Example:

\`\`\`${TAILORED_BLOCK}
${JSON.stringify(TAILORED_EXAMPLE, null, 2)}
\`\`\`
```

- [ ] **Step 4: Run to verify it passes** — `cd apps/web && pnpm exec vitest run --project unit src/lib/chat` → PASS.
- [ ] **Step 5: Checks (no commit)** — `pnpm lint && pnpm typecheck`.

---

### Task 4: `TailoredCv` molecule

**Files:**
- Create: `apps/web/src/components/molecules/TailoredCv/TailoredCv.tsx`, `index.ts`, `TailoredCv.stories.tsx`

**Interfaces:**
- Consumes: `TailorResult`, `TailoredBlock` from `@/lib/chat`; `ProfilePreview`; `Icon`.
- Produces: `TailoredCv(props: TailoredCvProps)`, `type TailoredCvProps = TailorResult & { job: TailoredBlock["job"]; className?: string }`.

- [ ] **Step 1: Write the stories** — `TailoredCv.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { TailoredCv } from "./TailoredCv";

const meta = {
  title: "Molecules/TailoredCv",
  component: TailoredCv,
  parameters: { layout: "padded" },
  args: {
    job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
    cv: {
      basics: { name: "Jane Citizen", headline: "Senior Front-end Engineer · React" },
      work: [{ employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021", end: "present", highlights: ["Led the React rebuild of the loan portal."] }],
    },
    flags: [],
    reworded: [{ where: "Senior Front-end Engineer · Acme Lending", text: "Led the React rebuild of the loan portal.", originals: ["Led the React rebuild of the customer loan portal (40,000 monthly users)."] }],
    leftOut: {
      roles: ["Front-end Engineer · Globex Insurance"],
      bullets: [{ where: "Senior Front-end Engineer · Acme Lending", text: "Mentored 2 graduate engineers." }],
      projects: [],
      education: [],
      certificates: [],
      languages: ["Mandarin"],
    },
  },
  render: (args) => (
    <div className="max-w-xl">
      <TailoredCv {...args} />
    </div>
  ),
} satisfies Meta<typeof TailoredCv>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoFlags: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeInTheDocument();
    await expect(canvas.queryByText(/things? to check/)).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.getByText("Review changes: 1 reworded · 3 left out")).toBeInTheDocument();
    // Closed by default; its content is there for when it opens.
    await expect(canvasElement.querySelector("details")).not.toHaveAttribute("open");
    await expect(canvas.getByText("Original: Led the React rebuild of the customer loan portal (40,000 monthly users).")).not.toBeVisible();
  },
};

export const WithFlags: Story = {
  args: {
    flags: [
      { level: "blocking", message: 'This bullet isn\'t based on anything in your profile: "Led a team of 10."' },
      { level: "warning", message: "Not in your profile: GraphQL" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 4, name: "2 things to check" })).toBeInTheDocument();
    const blocking = canvas.getByRole("list", { name: "Fix before downloading" });
    await expect(blocking).toHaveTextContent("Led a team of 10.");
    await expect(canvas.getByRole("list", { name: "Worth a look" })).toHaveTextContent("Not in your profile: GraphQL");
  },
};

export const OneWarning: Story = {
  args: { flags: [{ level: "warning", message: "Not in your profile: GraphQL" }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 4, name: "1 thing to check" })).toBeInTheDocument();
    await expect(canvas.queryByRole("list", { name: "Fix before downloading" })).not.toBeInTheDocument();
  },
};

export const LongText: Story = {
  args: {
    job: { title: "Principal Engineer, Developer Experience and Internal Tooling", employer: "A Very Long Company Name Pty Ltd" },
    flags: [{ level: "blocking", message: `This bullet isn't based on anything in your profile: "${"x".repeat(300)}"` }],
  },
  render: (args) => (
    <div className="w-[320px]">
      <TailoredCv {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("article")!;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
```

- [ ] **Step 2: Run to verify it fails** — `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/TailoredCv` → FAIL (cannot resolve `./TailoredCv`).

- [ ] **Step 3: Implement** — `TailoredCv.tsx`

```tsx
import { Icon } from "@/components/atoms/Icon";
import { ProfilePreview } from "@/components/molecules/ProfilePreview";
import type { TailoredBlock, TailorFlag, TailorResult } from "@/lib/chat";
import { cn } from "@/lib/cn";

export type TailoredCvProps = TailorResult & { job: TailoredBlock["job"]; className?: string };

function FlagList({ title, flags, tone }: { title: string; flags: TailorFlag[]; tone: "danger" | "warning" }) {
  if (flags.length === 0) return null;
  return (
    <div className="mt-2">
      <p className={cn("text-sm font-semibold", tone === "danger" ? "text-danger" : "text-warning")}>{title}</p>
      <ul aria-label={title} className="mt-1 space-y-1">
        {flags.map((flag, index) => (
          <li key={index} className="flex gap-2">
            <Icon name="alert-circle" className={cn("mt-0.5 size-4", tone === "danger" ? "text-danger" : "text-warning")} />
            <span>{flag.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A CV tailored to one job: what to check (blocking first), the CV as it would be downloaded, and the
 * changes to review (each reworded bullet with its original, and what was left out). Presentational:
 * the data comes from tailorCv, which takes every fact from the profile.
 */
export function TailoredCv({ job, cv, flags, reworded, leftOut, className }: TailoredCvProps) {
  const blocking = flags.filter((flag) => flag.level === "blocking");
  const warnings = flags.filter((flag) => flag.level === "warning");
  const leftOutGroups: [string, string[]][] = [
    ["Roles", leftOut.roles],
    ["Bullets", leftOut.bullets.map((bullet) => `${bullet.where}: ${bullet.text}`)],
    ["Projects", leftOut.projects],
    ["Education", leftOut.education],
    ["Certificates", leftOut.certificates],
    ["Languages", leftOut.languages],
  ].filter((group): group is [string, string[]] => group[1].length > 0);
  const leftOutCount = leftOutGroups.reduce((total, [, items]) => total + items.length, 0);

  return (
    <article className={cn("my-2 rounded-card border border-border bg-surface p-4 break-words first:mt-0 last:mb-0", className)}>
      <h3 className="text-lead font-semibold">{job.employer ? `Tailored for ${job.title} · ${job.employer}` : `Tailored for ${job.title}`}</h3>

      {flags.length > 0 && (
        <section className="mt-3 rounded-control border border-border bg-surface-muted p-3">
          <h4 className="font-semibold">{flags.length === 1 ? "1 thing to check" : `${flags.length} things to check`}</h4>
          <FlagList title="Fix before downloading" flags={blocking} tone="danger" />
          <FlagList title="Worth a look" flags={warnings} tone="warning" />
        </section>
      )}

      <ProfilePreview {...cv} className="mt-3 border-0 p-0" />

      <details className="group mt-3 border-t border-border pt-3">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
          Review changes: {reworded.length} reworded · {leftOutCount} left out
          <Icon name="chevron-down" className="size-4 group-open:rotate-180 motion-safe:transition-transform" />
        </summary>
        {reworded.length > 0 && (
          <section className="mt-2">
            <h4 className="font-semibold">Reworded</h4>
            <ul className="mt-1 space-y-2">
              {reworded.map((bullet, index) => (
                <li key={index}>
                  <p>{bullet.text}</p>
                  {bullet.originals.map((original, i) => (
                    <p key={i} className="text-sm text-fg-muted">
                      Original: {original}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}
        {leftOutGroups.length > 0 && (
          <section className="mt-3">
            <h4 className="font-semibold">Left out</h4>
            {leftOutGroups.map(([label, items]) => (
              <div key={label} className="mt-1">
                <p className="text-sm font-semibold">{label}</p>
                <ul className="list-disc pl-5 text-sm">
                  {items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </details>
    </article>
  );
}
```

`ProfilePreview` accepts `className` and merges it with `cn()`, so `border-0 p-0` removes its own card frame inside this card. `text-danger`/`text-warning` on `bg-surface-muted` must be AAA: Foundations / Colors checks them on `canvas` and their own surfaces; if axe or the contrast story flags `surface-muted`, use `bg-surface` for the box and ledger it.

`index.ts`:

```ts
export { TailoredCv } from "./TailoredCv";
export type { TailoredCvProps } from "./TailoredCv";
```

- [ ] **Step 4: Run to verify it passes** — `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/TailoredCv` → PASS, no axe violations.
- [ ] **Step 5: Checks (no commit)** — `pnpm lint && pnpm lint:style && pnpm typecheck`.

---

### Task 5: `ChatBubble`: `BlockContext`, one block map, tailored view

**Files:**
- Modify: `apps/web/src/components/molecules/ChatBubble/ChatBubble.tsx`, `ChatBubble.stories.tsx`

**Interfaces:**
- Consumes: `TAILORED_BLOCK`, `parseTailoredBlock`, `tailorCv`, `type TailoredBlock` (`@/lib/chat`); `TailoredCv` (Task 4).
- Produces: `ChatBubbleProps.collapse?: string[]` (block languages to show collapsed; replaces `collapseProfile`), `ChatBubbleProps.referenceProfile?: Profile`.

- [ ] **Step 1: Update and add stories** — in `ChatBubble.stories.tsx`:
  - In `ProfileCollapsed`, replace `collapseProfile: true` with `collapse: ["profile"]`.
  - Add before `Typing`:

```tsx
const REFERENCE_PROFILE = {
  basics: { name: "Jane Citizen" },
  work: [{ employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021", end: "present", highlights: ["Led the React rebuild of the loan portal."] }],
};
const TAILORED_JSON = JSON.stringify({
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  work: [{ role: 0, highlights: [{ text: "Led the React and TypeScript rebuild of the loan portal.", from: [0] }] }],
  skills: [{ keywords: ["React", "GraphQL"] }],
});
const TAILORED_REPLY = `Here's your CV tailored for the role.\n\n\`\`\`tailored\n${TAILORED_JSON}\n\`\`\``;

/** A ```tailored block, checked against the reference profile. */
export const WithTailoredCv: Story = {
  args: { from: "assistant", author: "CV coach", children: TAILORED_REPLY, referenceProfile: REFERENCE_PROFILE },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeInTheDocument();
    await expect(canvas.getByText("Not in your profile: GraphQL")).toBeInTheDocument();
    await expect(canvas.getByText("Senior Front-end Engineer · Acme Lending")).toBeInTheDocument();
  },
};

/** No valid profile in the conversation: nothing to check against. */
export const TailoredWithoutProfile: Story = {
  args: { from: "assistant", author: "CV coach", children: TAILORED_REPLY },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This tailored CV needs your profile: ask me to read your CV first.")).toBeInTheDocument();
  },
};

export const TailoredCollapsed: Story = {
  args: { from: "assistant", author: "CV coach", children: TAILORED_REPLY, referenceProfile: REFERENCE_PROFILE, collapse: ["tailored"] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Earlier version of your tailored CV")).toBeInTheDocument();
    await expect(canvas.getByText("Not in your profile: GraphQL")).not.toBeVisible();
  },
};

export const TailoredStreaming: Story = {
  args: { from: "assistant", author: "CV coach", streaming: true, children: `Here's your CV.\n\n\`\`\`tailored\n${TAILORED_JSON.slice(0, 30)}`, referenceProfile: REFERENCE_PROFILE },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing your tailored CV…");
  },
};

export const TailoredBroken: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's your CV.\n\n\`\`\`tailored\n${TAILORED_JSON.slice(0, 30)}`, referenceProfile: REFERENCE_PROFILE },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This tailored CV couldn't be shown. It may have been cut off: ask me to try again.")).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run to verify it fails** — `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ChatBubble` → FAIL (tailored shows as code; `collapse` not a prop).

- [ ] **Step 3: Implement** — in `ChatBubble.tsx`:
  - Add `"use client";` as the first line (it now uses context).
  - Imports: add `createContext, useContext` from `react` (with `ReactNode`); `TailoredCv` from `@/components/molecules/TailoredCv`; from `@/lib/chat` add `parseTailoredBlock, TAILORED_BLOCK, tailorCv, type TailoredBlock`.
  - Props: replace `collapseProfile?: boolean` (and its comment) with

```tsx
  /** Block languages to show collapsed (earlier versions: a newer one follows), e.g. ["profile"]. */
  collapse?: string[];
  /** The newest valid profile in the conversation: tailored CVs are checked against it. */
  referenceProfile?: Profile;
```

  - Replace everything from `type BlockSpec<T>` through `const COLLAPSED_BLOCKS = blocks(false, true);` with:

```tsx
/** What a bubble's blocks need to know: set per bubble, read by the module-level block renderers. */
type BlockContextValue = { streaming: boolean; collapse: readonly string[]; referenceProfile?: Profile };
const BlockContext = createContext<BlockContextValue>({ streaming: false, collapse: [] });

/** How a component block shows: its parser, its view, and what to say while it streams, when it fails, and when collapsed. */
type BlockSpec<T> = {
  language: string;
  parse: (code: string) => T | undefined;
  render: (value: T, context: BlockContextValue) => ReactNode;
  preparing: string;
  /** Usually a reply cut off by the length cap: the stream ends normally, so nothing else says so. */
  failed: string;
  /** The summary of an earlier, collapsed version. */
  earlier?: string;
};

const MATCH: BlockSpec<MatchBlock> = {
  language: MATCH_BLOCK,
  parse: parseMatchBlock,
  render: (report) => <MatchReport {...report} />,
  preparing: "Preparing match report…",
  failed: "This match report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer requirements.",
};

const PROFILE: BlockSpec<Profile> = {
  language: PROFILE_BLOCK,
  parse: parseProfileBlock,
  render: (profile) => <ProfilePreview {...profile} />,
  preparing: "Preparing your profile…",
  failed: "This profile couldn't be shown. It may have been cut off: ask me to try again.",
  earlier: "Earlier version of your profile",
};

const TAILORED: BlockSpec<TailoredBlock> = {
  language: TAILORED_BLOCK,
  parse: parseTailoredBlock,
  render: (block, { referenceProfile }) =>
    referenceProfile ? (
      <TailoredCv job={block.job} {...tailorCv(referenceProfile, block)} />
    ) : (
      <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">This tailored CV needs your profile: ask me to read your CV first.</p>
    ),
  preparing: "Preparing your tailored CV…",
  failed: "This tailored CV couldn't be shown. It may have been cut off: ask me to try again.",
  earlier: "Earlier version of your tailored CV",
};

/**
 * A reply's component block. Its JSON is judged by whether it parses: an open fence runs to the end
 * of the text, so a half-received block looks like a whole one. An earlier version shows collapsed.
 */
function BlockView<T>({ code, spec }: { code: string; spec: BlockSpec<T> }) {
  const context = useContext(BlockContext);
  const value = spec.parse(code);
  let view: ReactNode;
  if (value !== undefined) view = spec.render(value, context);
  else if (context.streaming) {
    view = (
      <div role="status" className="my-2 space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">{spec.preparing}</p>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  } else view = <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">{spec.failed}</p>;

  if (!spec.earlier || !context.collapse.includes(spec.language)) return view;
  return (
    <details className="group my-2">
      {/* The browser's own marker differs per browser (Safari keeps it): hidden, a chevron instead. */}
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control border border-border bg-surface px-3 text-sm font-semibold focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
        {spec.earlier}
        <Icon name="chevron-down" className="size-4 group-open:rotate-180 motion-safe:transition-transform" />
      </summary>
      {view}
    </details>
  );
}

// One module-level map, so Markdown keeps reply blocks mounted while a reply streams in (a new map
// each render would remount them on every chunk). What changes per bubble (streaming, collapsed,
// reference profile) comes through BlockContext instead.
const BLOCKS: MarkdownBlocks = {
  [MATCH_BLOCK]: (code) => <BlockView code={code} spec={MATCH} />,
  [PROFILE_BLOCK]: (code) => <BlockView code={code} spec={PROFILE} />,
  [TAILORED_BLOCK]: (code) => <BlockView code={code} spec={TAILORED} />,
};
```

  - Signature: replace `collapseProfile = false` with `collapse = NO_COLLAPSE, referenceProfile` and add above the component `const NO_COLLAPSE: string[] = [];`.
  - Replace the Markdown line with:

```tsx
          <BlockContext value={{ streaming, collapse, referenceProfile }}>
            <Markdown blocks={BLOCKS}>{children ?? ""}</Markdown>
          </BlockContext>
```

  (React 19 renders a context directly as its provider.)

- [ ] **Step 4: Run to verify it passes** — `cd apps/web && pnpm exec vitest run --project storybook src/components/molecules/ChatBubble` → PASS (new stories and all existing ones, including `BlocksStayMounted` and the match stories).
- [ ] **Step 5: Checks (no commit)** — `pnpm lint && pnpm lint:style && pnpm typecheck`. Typecheck will flag `ChatWindow` still passing `collapseProfile`: fixed in Task 6 — if you prefer the tree green between tasks, do Task 6 Step 3's prop change now and ledger it.

---

### Task 6: `ChatWindow`: reference profile and newest versions

**Files:**
- Modify: `apps/web/src/components/organisms/ChatWindow/ChatWindow.tsx`, `ChatWindow.stories.tsx`

- [ ] **Step 1: Write the failing stories** — append to `ChatWindow.stories.tsx` (reusing `profileReply` from the profile story):

```tsx
const profileWith = (roles: { employer: string; position: string }[]) =>
  `Here's your profile.\n\n\`\`\`profile\n${JSON.stringify({ basics: { name: "Jane Citizen" }, work: roles })}\n\`\`\``;
const tailoredReply = (title: string, role: number) =>
  `Here's your tailored CV.\n\n\`\`\`tailored\n${JSON.stringify({ job: { title }, work: [{ role }] })}\n\`\`\``;

/** Profiles and tailored CVs interleaved: the newest of each is open; tailored CVs use the newest valid profile. */
export const TailoredVersions: Story = {
  args: {
    assistantName: "CV coach",
    messages: [
      { id: "1", from: "user", text: "Read my CV" },
      { id: "2", from: "assistant", text: profileWith([{ employer: "Acme", position: "Engineer" }, { employer: "Globex", position: "Developer" }]) },
      { id: "3", from: "user", text: "Tailor it" },
      { id: "4", from: "assistant", text: tailoredReply("Old job", 0) },
      { id: "5", from: "user", text: "Drop Globex from my profile" },
      { id: "6", from: "assistant", text: profileWith([{ employer: "Acme", position: "Engineer" }]) },
      { id: "7", from: "user", text: "Tailor again" },
      { id: "8", from: "assistant", text: tailoredReply("New job", 1) },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Earlier version of your profile")).toHaveLength(1);
    await expect(canvas.getAllByText("Earlier version of your tailored CV")).toHaveLength(1);
    await expect(canvas.getByText("Tailored for New job")).toBeVisible();
    // Checked against the newest profile, which has no role 1 any more.
    await expect(canvas.getByText("A role that isn't in your profile (number 2) was skipped.")).toBeVisible();
  },
};
```

- [ ] **Step 2: Run to verify it fails** — `cd apps/web && pnpm exec vitest run --project storybook src/components/organisms/ChatWindow` → FAIL.

- [ ] **Step 3: Implement** — in `ChatWindow.tsx`:
  - Import from `@/lib/chat`: `blockContents, hasBlock, parseProfileBlock, PROFILE_BLOCK, TAILORED_BLOCK, type Profile`.
  - Replace the `latestProfileId` line with:

```tsx
  // Corrections give new versions: only the newest profile and the newest tailored CV stay open.
  const newest = (language: string) => messages.findLast((message) => message.from === "assistant" && hasBlock(message.text, language))?.id;
  const latestProfileId = newest(PROFILE_BLOCK);
  const latestTailoredId = newest(TAILORED_BLOCK);
  // Tailored CVs are checked against the newest profile that is valid (a broken one doesn't count).
  let referenceProfile: Profile | undefined;
  for (const message of messages.toReversed()) {
    if (message.from !== "assistant") continue;
    referenceProfile = blockContents(message.text, PROFILE_BLOCK).map(parseProfileBlock).findLast(Boolean);
    if (referenceProfile) break;
  }
  const collapsed = (message: ChatMessage) =>
    message.from !== "assistant"
      ? []
      : [PROFILE_BLOCK, TAILORED_BLOCK].filter((language) => hasBlock(message.text, language) && message.id !== (language === PROFILE_BLOCK ? latestProfileId : latestTailoredId));
```

  - On `ChatBubble` replace `collapseProfile={…}` with:

```tsx
            collapse={collapsed(message)}
            referenceProfile={referenceProfile}
```

- [ ] **Step 4: Run to verify it passes** — `cd apps/web && pnpm exec vitest run --project storybook src/components/organisms/ChatWindow src/components/molecules/ChatBubble` → PASS (including `ProfileVersions`).
- [ ] **Step 5: Checks (no commit)** — `pnpm lint && pnpm typecheck`.

---

### Task 7: e2e: tailoring through the real page

**Files:**
- Modify: `apps/web/e2e/mock-llm.mjs`, `apps/web/e2e/chat.spec.ts`, `apps/web/e2e/security.spec.ts`

- [ ] **Step 1: Write the failing tests** — in `chat.spec.ts` after `"explains a profile it can't show"`:

```ts
  test("tailors the CV against the profile, flagging what's new", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await sendMessage(page, "Tailor my CV for this job [tailored]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");

    await expect(log(page).getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeVisible();
    await expect(log(page).getByRole("heading", { level: 4, name: "2 things to check" })).toBeVisible();
    await expect(log(page).getByRole("list", { name: "Fix before downloading" })).toContainText("Led a team of 10 engineers.");
    await expect(log(page).getByRole("list", { name: "Worth a look" })).toContainText("Not in your profile: GraphQL");
    // Facts come from the profile.
    await expect(log(page).getByText("Senior Front-end Engineer · Acme Lending").filter({ visible: true })).toHaveCount(1);
    await log(page).getByText(/^Review changes:/).click();
    await expect(log(page).getByText("Original: Led the React rebuild of the loan portal.")).toBeVisible();
    await expect(log(page).getByText("Front-end Engineer · Globex Insurance").filter({ visible: true }).last()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("explains a tailored CV it can't show", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await sendMessage(page, "Tailor my CV [tailored-broken]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("This tailored CV couldn't be shown. It may have been cut off: ask me to try again.");
  });
```

In `security.spec.ts`, rename the chat test to `"the CSP blocks nothing in the chat, including a match report, a profile and a tailored CV"` and add before its final `expect(await violations(page))…`:

```ts
  await expect(page.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-busy", "false");
  await page.getByRole("textbox", { name: "Message" }).fill("Tailor my CV [tailored]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeVisible();
```

The e2e server allows 3 messages per visitor; the security test now sends 3 (match, profile, tailored). That is within the limit.

- [ ] **Step 2: Run to verify they fail** — `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts -g "tailor"` → FAIL.

- [ ] **Step 3: Implement the mock** — in `mock-llm.mjs`:
  - Header comment: add `"[tailored]" replies with a tailored CV block (one bullet without a source, one skill not in the profile), "[tailored-broken]" with one that never completes.`
  - Give the mock profile's first role highlights (the profile e2e still expects "Mar 2021 – Present"): in `PROFILE_JSON`, the Acme role gets `highlights: ["Led the React rebuild of the loan portal.", "Mentored 2 graduate engineers."]`.
  - Add after the profile replies:

```js
const TAILORED_JSON = JSON.stringify({
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  headline: "Senior Front-end Engineer · React",
  work: [
    {
      role: 0,
      highlights: [
        { text: "Led the React and TypeScript rebuild of the loan portal.", from: [0] },
        { text: "Led a team of 10 engineers." },
      ],
    },
  ],
  skills: [{ keywords: ["React", "GraphQL"] }],
});
const tailoredHalf = Math.floor(TAILORED_JSON.length / 2);
const TAILORED_REPLY = ["Here's your CV tailored for the role.\n\n```tailored\n", TAILORED_JSON.slice(0, tailoredHalf), TAILORED_JSON.slice(tailoredHalf), "\n```"];
const TAILORED_BROKEN_REPLY = ["Here's your CV tailored for the role.\n\n```tailored\n", TAILORED_JSON.slice(0, tailoredHalf)];
```

  - In `MARKER_REPLIES`, add before `["[markdown]", MARKDOWN_REPLY]`: `["[tailored-broken]", TAILORED_BROKEN_REPLY], ["[tailored]", TAILORED_REPLY],`.

- [ ] **Step 4: Run to verify they pass, then both specs** — `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts` → all pass; run it twice to catch flakiness.
- [ ] **Step 5: Checks (no commit)** — `pnpm lint && pnpm typecheck`.

---

### Task 8: Verification, manual check, screenshots

- [ ] **Step 1: Full gates** (repo root): `pnpm lint && pnpm lint:style && pnpm typecheck && pnpm --filter @brighte/web test` — all pass.
- [ ] **Step 2: Lighthouse:** `cd apps/web && pnpm build`, `WEB_PORT=3201 pnpm start` (background), `WEB_PORT=3201 pnpm lighthouse`; `/chat` ≥ thresholds; stop the server.
- [ ] **Step 3: Manual:** `CHAT_PERSONA=career WEB_PORT=3202 pnpm start` (background). In the browser at 1280px: attach `.playwright-mcp/jane-citizen-cv.txt` and `.playwright-mcp/senior-frontend-job.txt`, "Read my CV into a profile", then "Tailor my CV for this job", then a correction ("Put the accessibility work first"). Check: facts unchanged from the profile; bullets reworded only; sensible left-out items; flags make sense (GraphQL must not appear as a skill, or if it does it is flagged); "Review changes" shows originals. Screenshots `.playwright-mcp/tailored-desktop.png` and at 375×812 `.playwright-mcp/tailored-mobile.png`. Stop the server.
- [ ] **Step 4: Report** to the user; do not commit; ask about commit and PR (base `feat/chat-profile` until #62 merges).
