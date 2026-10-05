# Chat tailored CV: a CV tailored to one job, checked against the profile

Date: 2026-10-05 · Status: draft for review · Branch: `feat/chat-tailored-cv` (stacked on
`feat/chat-profile`, PR #62, itself on PR #61)

## Context and goal

The CV-tailoring assistant is built in four projects:

1. Match report (PR #61).
2. Profile extraction (PR #62): the CV as a structured profile, the source of truth.
3. **Tailored CV** (this spec): a version of the profile tailored to one job, with its facts taken
   from the profile and everything new checked in code.
4. Templates, preview and PDF download (and saving the profile as a file). Renders this project's
   merged CV; refuses the download while blocking flags remain.

**Fixed requirement:** never invent experience, skills, employers, dates, qualifications or numbers.

**Success criteria:** with `CHAT_PERSONA=career`, a profile in the conversation and a job ad, asking
"Tailor my CV for this job" gives one sentence and a tailored CV: the CV as it would be downloaded,
a list of things to check (blocking first), and a "Review changes" section showing each reworded
bullet with its original and everything left out. Employer, job title, dates and degrees can't be
changed. Corrections give a full updated tailored CV; earlier versions collapse. Correcting the
profile afterwards re-checks the tailored CV. Works at 320px, by keyboard and screen reader (WCAG 2.1
AA, AAA text contrast).

## Decisions

- **What tailoring may change:**

  | Part | May | Never |
  |---|---|---|
  | Headline, summary | Rewrite for the job from profile facts | Claim what the profile doesn't support |
  | Roles, projects | Reorder bullets, reword with the ad's terms, leave out bullets or whole roles | Change employer, title or dates; add one |
  | Skills | Reorder, regroup, use the ad's name for a skill the profile has | Add a skill the profile lacks |
  | Education, certificates, languages | Reorder, leave out | Change an entry |

- **Show left-out items and each reworded bullet's original.**
- **Problems are shown, flagged** (not blocked, not silently retried). Blocking flags disable the
  PDF in project 4.
- **Profile first:** asked to tailor without a profile, the coach builds the profile and asks the
  visitor to check it; tailoring happens on the next message.
- **By reference:** the tailored block points at profile entries by index and never restates facts.
  Chosen over a full copy matched by text: facts can't drift, originals and left-out items are exact,
  and flags cover only what is new.
- **Reference profile:** the newest *valid* profile in the conversation. A later profile correction
  re-checks every tailored CV against it.

## Data: the `tailored` block

`src/lib/chat/tailored-block.ts` (browser-safe, exported from `@/lib/chat`): `TAILORED_BLOCK =
"tailored"`, the Zod schema, types and `parseTailoredBlock(code)`. Same tolerance as the profile:
nulls and blank strings count as left out (stripped before parsing), unknown fields dropped.

```ts
index = integer ≥ 0
bullet = { text: 1–600, from?: index[] ≤10 }          // from: the profile bullets it rewords
{
  job: { title: 1–160, employer?: ≤160 },             // the job it is tailored for
  headline?: ≤160, summary?: ≤2000,                   // replace the profile's when present
  work?:      [{ role: index, highlights?: bullet[] ≤20 }] ≤30,       // CV order
  projects?:  [{ project: index, highlights?: bullet[] ≤20 }] ≤20,
  skills?:    [{ group?: ≤60, keywords: string ≤60 [1–60] }] ≤20,
  education?: index[] ≤15, certificates?: index[] ≤30, languages?: index[] ≤15,
}
```

A section left out of the block means "none of it" (left out), not "all of it".

## `tailorCv(profile, tailored)`

A pure function in `src/lib/chat/tailor.ts` (browser-safe). Returns:

- **`cv: Profile`**, the merged CV in the profile's shape (project 4 renders this):
  - `basics`: the profile's, with `headline` and `summary` replaced when the block has them.
  - `work` and `projects`: in the block's order, each the referenced profile entry with every fact
    unchanged and `highlights` replaced by the block's bullet texts (none when the block lists none).
    Role and project `skills` stay the profile's.
  - `skills`: the block's groups when present, otherwise none.
  - `education`, `certificates`, `languages`: the referenced entries in the block's order.
- **`leftOut`**: the profile's roles, projects, education, certificates and languages not referenced,
  and, for each referenced role or project, its bullets no tailored bullet cites in `from`.
- **`originals`**: for each tailored bullet, the profile bullet texts its `from` points at.
- **`flags`**, each with a level, a kind, where it is and a message:
  - **Blocking:** a reference to an entry or bullet that doesn't exist (the entry or that source is
    skipped); a bullet with no `from` or an empty one (a new claim).
  - **Warning:** a skill (in the block's skills) not in the profile, comparing case-insensitively
    without spaces and punctuation ("next.js" = "Next.js"; "React.js" ≠ "React", so synonyms are
    flagged for the visitor to accept); a number in a bullet that isn't in its originals; a number in
    the headline or summary that is nowhere in the profile. A number is a run of digits, compared
    without separators ("40,000" = "40000"; "40k" is the number 40).

## Components

- **`TailoredCv` molecule** (presentational; props: the `tailorCv` result plus `job`):
  1. Header: "Tailored for {title} · {employer}" as an `<h3>`.
  2. Flags: when any, a box "N things to check" listing blocking flags first under "Fix before
     downloading", then warnings. Text plus an icon, never colour alone.
  3. The CV: `ProfilePreview` (unchanged) with the merged `cv`.
  4. "Review changes": a closed `<details>` whose summary counts "N reworded · M left out", with
     "Reworded" (each tailored bullet, then "Original:" and its source text) and "Left out" (grouped:
     roles, bullets, projects, education, certificates, languages).
- **Block context refactor (`ChatBubble`):** one module-level block map for all block types. Each
  bubble provides a `BlockContext` with `streaming`, the block types to show collapsed, and the
  reference profile; block renderers read it. Replaces the per-combination maps (`BLOCKS`,
  `STREAMING_BLOCKS`, `COLLAPSED_BLOCKS`). Blocks still don't remount while a reply streams.
  `ChatBubble` gets `collapse?: string[]` (block languages) in place of `collapseProfile`, and
  `referenceProfile?: Profile`.
- **Tailored block view:** valid block and a reference profile → `TailoredCv` of `tailorCv(...)`;
  valid block but no valid profile in the conversation → the note "This tailored CV needs your
  profile: ask me to read your CV first."; invalid while streaming → "Preparing your tailored CV…";
  invalid after → "This tailored CV couldn't be shown. It may have been cut off: ask me to try
  again."
- **`ChatWindow`:** finds the newest valid profile (parsed) and passes it to every bubble; collapses
  every profile but the newest and every tailored CV but the newest ("Earlier version of your
  tailored CV").

## Persona

- Asked to tailor (or "Tailor my CV for this job"):
  - with a profile and a job ad: one sentence, then a ` ```tailored ` block (JSON Schema from the Zod
    schema, one example);
  - with no profile: build the profile first, ask the visitor to check it, tailor on the next message;
  - with no job ad: ask for it.
- Rules: the decision table; every reworded bullet lists `from` (0-based indexes of the role's
  bullets in the newest profile); roles, projects and entries are 0-based indexes in the newest
  profile; never add a role, skill or number; the ad's wording only for skills the profile has.
- Corrections ("put Globex first", "drop the Redux bullet"): a short note, then the full updated block.
- Suggestions: "Read my CV into a profile", "How well does my CV match this job?", "Tailor my CV for
  this job".
- Limits unchanged (career 8,000 characters, 8,192 tokens).

## Testing

- **Unit (Vitest):**
  - `tailorCv` merging: tailored headline/summary replace the profile's, name and contact stay; work
    and projects in tailored order; education/certificates/languages by index; facts only from the
    profile.
  - `leftOut`: unreferenced entries and uncited bullets; empty when everything is used.
  - `originals`: exact profile text per bullet.
  - Blocking flags: role, project, bullet source, education, certificate and language index out of
    range (skipped and flagged); a bullet with no or empty `from`.
  - Warnings: a skill not in the profile; no flag for case or punctuation differences; a number not
    in the originals; no flag when it is; a summary number nowhere in the profile; "40,000" =
    "40000".
  - Re-check: the same block against a corrected profile.
  - Tailored schema: valid and invalid indexes, missing `job.title`, blanks and nulls, incomplete
    JSON.
  - Persona: rules, schema and suggestions.
- **Stories (Chromium + axe):**
  - `TailoredCv`: no flags; blocking and warning flags; review section; long text at 320px.
  - `ChatBubble`: tailored block with a reference profile; without one (the note); collapsed earlier
    tailored CV; blocks stay mounted while streaming; match and profile stories unchanged.
  - `ChatWindow`: a profile corrected after tailoring updates the tailored CV's flags.
- **e2e:** mock `[tailored]` (one bullet without `from`, one new skill) and `[tailored-broken]`; a
  conversation `[profile]` then `[tailored]` checks the CV, both flags and "Review changes"; axe;
  the CSP spec covers it.
- **Manual:** career persona with the sample CV and job ad: profile, "Tailor my CV for this job", a
  correction; check it rewords only, leaves out sensibly and invents nothing; screenshots at 1280px
  and 375px.
- **Definition of done:** `pnpm lint && pnpm lint:style && pnpm typecheck`, all web tests, chat and
  security e2e, Lighthouse on `/chat`.

## Out of scope

- Templates, the PDF, disabling the download on blocking flags, saving the profile (project 4).
- Accepting a warning in the UI ("this synonym is fine"): the visitor asks the coach to change it or
  ignores it.
- Tailoring for several jobs side by side (each tailored CV is its own reply; the newest is open).
