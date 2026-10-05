# Chat profile: extract a CV into a structured profile

Date: 2026-10-05 · Status: draft for review · Branch: `feat/chat-profile` (stacked on
`feat/chat-match-report`, PR #61)

## Context and goal

The CV-tailoring assistant is built in four projects, each with its own spec, plan and PR:

1. Match report (done, PR #61): ` ```match ` blocks rendered as a `MatchReport`.
2. **Profile extraction** (this spec): the CV coach reads a CV into a structured profile, shown as
   a preview the visitor checks and corrects by chatting.
3. Tailored CV: a tailored copy of the profile for one job, matched skills highlighted, checked in
   code against the profile (employers, titles, dates and degrees must match; new skills flagged).
4. Templates and PDF: the profile or tailored CV rendered with a template, previewed, downloaded as
   PDF (and the profile saved as a file).

The profile is the single source of truth for 3 and 4: extraction mistakes are caught once, the
never-invent rule becomes checkable in code (project 3), and templates are pure presentation.

**Fixed requirement (all projects):** never invent experience, skills, employers, dates or
qualifications. At this stage the profile copies what the CV says: no rewording (that is project 3).

**Success criteria:** with `CHAT_PERSONA=career`, a visitor who attaches a CV and asks to read it
(or attaches it without saying what they want) gets one sentence and a profile preview: contact
details, summary, experience with dates, highlights and skills per role, education, skills,
certificates, projects and languages, as far as the CV states them. Saying what is wrong ("my Globex
role ended in 2020") gives a short note of the change and a full updated preview; earlier versions
collapse. Works at 320px, by keyboard and screen reader (WCAG 2.1 AA, AAA text contrast).

## Decisions

- **Correction:** by chat only. No form editing (could be added later; the data is the same).
- **Where:** inline in the chat bubble, like the match report. A side panel may come with project 3.
- **Persistence:** session only, like the rest of the chat. Saving the profile as a file comes with
  project 4.
- **Approach:** a ` ```profile ` JSON block in the reply, on the project 1 mechanism (Zod schema,
  renderer registered in `ChatBubble`, JSON Schema in the persona prompt). Chosen over a separate
  extraction endpoint using provider structured-output modes: that needs a second route, three
  provider-specific JSON modes and a way back into the chat, and chat corrections would need it too.
  It can still be added later for extraction alone if a model proves unreliable.

## Data: the `profile` block

`src/lib/chat/profile-block.ts` (browser-safe, exported from `@/lib/chat`): `PROFILE_BLOCK =
"profile"`, the Zod schema, its types and `parseProfileBlock(code)`. A subset of JSON Resume
(jsonresume.org) with friendlier names, plus skills per role.

```ts
date = string matching /^\d{4}(-(0[1-9]|1[0-2]))?$/       // "2019" or "2019-03", as precise as the CV
basics: {
  name: 1–120,                                            // required; every section is optional
  headline?: ≤160, email?: ≤200, phone?: ≤60,
  location?: { city?, region?, country? (each ≤100) },
  links?: [{ label ≤60, url ≤500 }] ≤10,
  summary?: ≤2000,
}
work?:         [{ employer 1–160, position 1–160, location? ≤160, start?: date,
                  end?: date | "present", summary? ≤2000, highlights?: string ≤600 [≤20],
                  skills?: string ≤60 [≤40] }] ≤30
education?:    [{ institution 1–160, qualification? ≤160, field? ≤160, start?: date, end?: date,
                  grade? ≤60 }] ≤15
skills?:       [{ group? ≤60, keywords: string ≤60 [1–60] }] ≤20
certificates?: [{ name 1–200, issuer? ≤160, date?: date }] ≤30
projects?:     [{ name 1–160, description? ≤2000, highlights?: string ≤600 [≤20],
                  skills?: string ≤60 [≤40], url? ≤500 }] ≤20
languages?:    [{ language 1–60, fluency? ≤60 }] ≤15
```

- Inside a section, an entry needs only what identifies it (a role's employer and position, a
  degree's institution, a certificate's or project's name, a language); everything else is optional.
- `end: "present"` is a current role; no `end` means the CV doesn't say.
- Link and project URLs come from the model (and so from the CV, which a visitor controls): one with
  no scheme (`linkedin.com/in/jane`) gets `https://`; anything but `http:` or `https:`
  (`javascript:`, `data:`) fails the profile.
- `null` anywhere optional is treated as left out; unknown fields are dropped; strings are trimmed.
- Limits are generous so a wordy real CV passes; text is never truncated (silently dropping CV text
  is worse than failing).
- `hasBlock(text, language)` (in `@/lib/chat`): true when the text has a fence line exactly
  ` ```<language> ` (not ` ```profile-x `, not the word in prose).

## Components

- **`ProfilePreview` molecule** (presentational; props = the parsed profile): a card like
  `MatchReport`.
  - Header: name as `<h3>`, headline, a contact line joining the parts present with " · " (location
    "City, Region, Country", email, phone), links opening in a new tab (with the "(opens in a new
    tab)" screen-reader hint).
  - Sections with `<h4>`, each left out when empty: Summary; Experience (per role: "Position ·
    Employer", then location and dates "Mar 2021 – Present" / "2017 – 2021" / "From 2019", summary,
    highlights as a list, skills as neutral `Badge`s); Education ("Qualification, Field ·
    Institution", dates, grade); Skills ("Group: a, b, c", or the keywords alone); Certificates;
    Projects; Languages.
  - Dates: "2019" stays "2019", "2019-03" shows "Mar 2019", `present` shows "Present".
- **`BlockView`** (in `ChatBubble`): the project 1 `MatchBlockView` generalised to any block: a
  parser, a component, a placeholder text and a failure text. Valid → component; invalid while
  streaming → skeleton + `role="status"` placeholder; invalid after → the failure note.
  - Match: "Preparing match report…" / "This match report couldn't be shown. It may have been cut
    off: ask me to try again, or to check fewer requirements." (unchanged).
  - Profile: "Preparing your profile…" / "This profile couldn't be shown. It may have been cut off:
    ask me to try again."
- **Earlier versions collapse:** `ChatBubble` gets `collapseProfile?: boolean`. When set, a profile
  block renders inside a closed `<details>` whose `<summary>` reads "Earlier version of your profile"
  (a ≥44px target, focus ring); opening it shows the full preview. `ChatWindow` sets it on every
  assistant message with a profile block except the newest one (`hasBlock(text, PROFILE_BLOCK)`).
  The block maps stay module-level, one per combination of `streaming` and `collapseProfile`, so
  blocks do not remount on every streamed chunk.

## Persona and limits

- **Career prompt additions:**
  - When the visitor asks to read their CV or build a profile, or attaches a CV without saying what
    they want: one sentence, then a ` ```profile ` block (JSON Schema from the Zod schema, one short
    example).
  - Extraction copies what the CV says: no rewording, keep the CV's date precision, leave out what it
    doesn't state, `"present"` only when the CV says the role is current.
  - Corrections: a short sentence naming the change, then the full updated block (never partial).
  - Match reports unchanged; once a profile exists the model may use it alongside the CV.
- **Suggestions:** "Read my CV into a profile", "How well does my CV match this job?", "Which skills
  should I highlight?"
- **Reply cap:** `career` `maxOutputTokens` 4096 → 8192 (`CHAT_MAX_OUTPUT_TOKENS` still overrides).
  `MAX_REPLY_CHARS` (40,000) still fits a profile reply (~30,000 characters at 8,192 tokens).
- **Cost note:** each correction re-sends earlier profiles (and the attached CV) as history; history
  stays capped at 20 turns.

## Testing

- **Unit (Vitest):**
  - Profile schema: a full profile and a name-only profile pass; nulls dropped and extra fields
    ignored; dates `2019` and `2019-03` and `end: "present"` pass; `March 2019`, `2019-3`, `2019-13`
    fail; a missing name, 31 roles and a 601-character highlight fail; incomplete JSON fails.
  - `hasBlock`: finds ` ```profile `; not ` ```profile-x ` nor the word in prose.
  - Career prompt contains both schemas and the extraction rules; career reply cap 8192.
- **Stories (Chromium + axe):**
  - `ProfilePreview`: full; name only; current role "– Present"; year-only dates; long text at 320px;
    links with their screen-reader hint.
  - `ChatBubble`: profile block; collapsed earlier version opens on click; streaming placeholder;
    failure note; blocks stay mounted while text is added.
  - `ChatWindow`: of two profiles, only the newest is expanded.
- **e2e:** mock markers `[profile]` and `[profile-broken]`; a conversation with two `[profile]`
  replies checks the first collapses and the second is expanded; axe; the CSP spec covers a profile.
- **Manual:** career persona with the sample CV ("Read my CV into a profile"), then a correction
  ("my Globex role ended in 2020"); screenshots at 1280px and 375px.
- **Definition of done:** `pnpm lint && pnpm lint:style && pnpm typecheck`, all web tests, chat and
  security e2e, Lighthouse on `/chat`.

## Out of scope

- Editing the profile in a form; a side panel; saving or loading the profile (project 4).
- Tailoring, the profile-vs-CV check, templates and PDF (projects 3 and 4).
- Profiles for the `brighte` and `general` personas (a block still renders if a model writes one).
