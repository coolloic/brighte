# Chat match report: rich components in chat replies

Date: 2026-10-05 · Status: draft for review · Branch: `feat/chat-match-report` (stacked on `feat/chat-markdown`, PR #60)

## Context and goal

The end product is a CV-tailoring assistant: the visitor uploads their CV and a job description, the
assistant shows how well they match, rewrites the CV to highlight the real matches (so it passes
automated CV screening), previews it, refines it through further prompts, and offers a well-formatted
PDF download. It is split into three projects, each with its own spec, plan and PR(s):

1. **Career persona + match report** (this spec): the general mechanism for showing our own React
   components inside a reply, and its first component.
2. Tailored CV draft, preview and refine (a `cv` block on the same mechanism).
3. PDF download of the tailored CV.

**Fixed requirement for all three:** the assistant may reword, reorder and emphasise what is in the
CV, and use the job ad's wording for skills the person really has. It never invents experience,
skills, dates or qualifications. An unmet requirement is reported as missing, with an honest
suggestion.

**Success criteria for this project:** with `CHAT_PERSONA=career`, a visitor who attaches a CV and a
job description and asks how well they match gets a short text answer plus a match report component:
overall score, and each requirement with its status, evidence from the CV and, where not met, a
suggestion. It works with every provider and model, at 320px, by keyboard and screen reader (WCAG 2.1
AA, AAA text contrast).

## Approach: component blocks inside the Markdown reply

The model writes a fenced code block whose language names a component, with JSON inside:

````markdown
Here's how your CV lines up with the role.

```match
{ "title": "Senior Front-end Engineer · Acme", "score": 72, "items": [ … ] }
```
````

The `Markdown` atom hands such blocks to a renderer, which validates the JSON with a Zod schema and
renders the component.

Chosen over native tool calling (needs event streams in all three provider clients, a structured
response stream, and tool-call/tool-result pairs in the history, which Anthropic requires to be
matched; no text after the tool call without a second request) and over migrating to the Vercel AI
SDK (rewrites the working LLM layer for one feature). With blocks, the provider clients, `/api/chat`
stream format, request schema and history format are unchanged: a reply stays one string, goes back to
the model as context as it does today, and model switching keeps working. Trade-off: no provider-side
schema enforcement; invalid output is handled in the UI (see Errors).

## Data: the `match` block

`src/lib/chat/match-block.ts` (browser-safe, exported from `@/lib/chat`): the Zod schema, its inferred
type, a `parseMatchBlock(code)` helper and the language name. Field names are generic: anything checked against a list of criteria fits.

```ts
matchBlockSchema = z.object({
  title: z.string().trim().min(1).max(120),       // "Senior Front-end Engineer · Acme"
  score: z.number().min(0).max(100),               // overall fit, rounded to a whole number
  summary: z.string().trim().max(400).optional(),  // 1–2 sentences
  items: z.array(z.object({                        // in the job ad's order
    requirement: z.string().trim().min(1).max(200),
    status: z.enum(["met", "partial", "missing"]),
    evidence: z.string().trim().max(400).optional(),   // what in the CV shows it
    suggestion: z.string().trim().max(400).optional(), // honest next step, for partial/missing
  })).min(1).max(30),
});
```

The same schema feeds the persona prompt through `z.toJSONSchema`, so prompt and parser cannot drift.

## Components

- **`Badge` atom:** new `success`, `warning`, `danger` tones from the existing role tokens
  (`*-surface` backgrounds with the text-safe shades). Those pairs are already in the Foundations /
  Colors contrast checks at 7:1.
- **`Markdown` atom:** new optional prop `blocks: Record<string, (props: { code: string }) => ReactNode>`.
  A fenced block whose language is a key renders through that function instead of `<pre>`. Unknown
  languages (including names like `constructor` that exist on every object) render as code, as today. The atom stays generic and imports no molecules.
- **`MatchReport` molecule** (presentational; props = the parsed block):
  - Header: title as an `<h3>`, score as large text ("72% match") with a decorative bar
    (`aria-hidden`; the text carries the value), the summary, and counts ("6 met · 2 partly · 2 missing").
  - A list (not a table, so it reads at 320px). Each item: status badge with icon and word (Met /
    Partly / Missing; never colour alone), requirement in bold, evidence below, and "Suggestion: …"
    when present.
- **`ChatBubble` molecule:** gets an optional `streaming` prop and passes
  `blocks={{ match: … }}` to `Markdown`. The `match` renderer parses and validates the JSON and picks
  one of: `MatchReport` (valid), a "Preparing match report…" placeholder (invalid and still streaming:
  skeleton plus `role="status"` text), or the failure note (invalid after the stream ended; see
  Errors).
- **`ChatWindow` organism:** passes `streaming` to the newest assistant bubble only, while a reply
  streams.

## Errors

- JSON incomplete while streaming: placeholder, as above. An open fence renders to the end of the
  text, so incompleteness is judged by "does it parse yet", not by the fence.
- Invalid JSON or schema mismatch after the stream (a weak model, or the token cap cut it off): the
  note. A reply cut off by the length cap ends like any other (providers report the cap only as a
  stop reason, which the clients don't read), so the note itself says what to do next: "This match
  report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer
  requirements."
- The note does not show the raw JSON to the visitor.

## Persona and config

- **New `career` persona** in `src/lib/chat/personas.ts`, selected with `CHAT_PERSONA=career`:
  - Name and title "CV coach"; a description for the page meta.
  - Greeting asks for a CV and a job description (attach a file or paste the text).
  - Suggestions: "How well does my CV match this job?", "Which skills should I highlight?",
    "What's missing for this role?"
  - System prompt:
    - Reads a CV and a job ad. When it has both and is asked about fit, it writes one or two
      sentences, then one ` ```match ` block (the JSON Schema plus one short example).
    - The never-invent rule. Evidence must come from the CV; anything not shown there is `missing`.
    - ATS-aware wording and Australian English.
    - Markdown for the rest of the reply.
  - `brighte` and `general` are unchanged; nothing tells them to write blocks (a block would still
    render if a model wrote one).
- **Reply cap per persona:** `Persona` gains `maxOutputTokens` (`career` 4096; `brighte` and
  `general` 1024). `CHAT_MAX_OUTPUT_TOKENS` overrides it when set; `chatConfig` returns it as optional.
- **Message length per persona:** a pasted job description is usually longer than the 1,000-character
  default. `Persona` gains `maxMessageChars` (`career` 8,000; `brighte` and `general` 1,000).
  `CHAT_MAX_MESSAGE_CHARS` overrides it when set. The resolved limit is used by both the server's
  request schema and the page's browser-side check, as today.
- **History limit:** `MAX_REPLY_CHARS` (longest earlier assistant reply accepted back) rises from
  16,000 to 40,000, so a 4,096-token reply full of JSON still fits.
- `.env.example` documents `career` and the per-persona defaults.

## Testing

- **Unit (Vitest):**
  - The match schema: a valid block passes; a score out of range, too many items, a missing field or
    an over-long string fails.
  - The career prompt contains the schema.
  - The per-persona reply cap and message limit, and their env overrides.
- **Stories (Chromium + axe):**
  - `Atoms/Badge` new tones.
  - `Molecules/MatchReport`: typical, all met, all missing, long text at 320px, and screen-reader text
    for the score and statuses.
  - `Atoms/Markdown`: a custom block renders; an unknown language stays code.
  - `ChatBubble`: a match block, the streaming placeholder, the failure note.
- **e2e:**
  - The mock LLM answers `[match]` with text plus a match block, streamed with the JSON split
    mid-way; the test checks the final report (heading, score, items), that no placeholder remains,
    and runs axe.
  - `[match-broken]` sends invalid JSON; the test checks the note.
- **Manual:** dev server with `CHAT_PERSONA=career`, a sample CV and job ad, screenshots at 1280px
  and 375px.
- **Definition of done:** `pnpm lint && pnpm lint:style && pnpm typecheck`, story tests, chat e2e,
  Lighthouse on `/chat`.

## Out of scope

- Generating, previewing or downloading a CV (projects 2 and 3).
- Native tool calling, other component types, and tools for the `brighte` and `general` personas.
- Choosing the persona in the UI (it stays an env setting).
