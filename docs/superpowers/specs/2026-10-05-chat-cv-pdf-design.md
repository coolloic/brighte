# Chat CV PDF: template, preview, download and saving the profile

Date: 2026-10-05 · Status: draft for review · Branch: `feat/chat-cv-pdf` (stacked on
`feat/chat-tailored-cv`, PR #64; retarget to `main` as soon as #64 merges)

## Context and goal

Project 4, the last of the CV coach:

1. Match report (#61). 2. Profile extraction (re-landed in #64). 3. Tailored CV (#64).
4. **Templates, preview and PDF download, and saving the profile** (this spec).

**Fixed requirement:** never invent. Extended to the download: a tailored CV with blocking flags can't
be downloaded from the chat. The server checks again what the page sends (both schemas, `tailorCv`
on that pair), which catches page bugs and stale state; it can't stop the CV's owner from sending
any profile they like through devtools, which is no threat to the rule (it is about the model).

**Success criteria:**
- The profile card offers **Preview PDF**, **Download PDF** and **Save profile**; the tailored CV card
  offers **Preview PDF** and **Download PDF**.
- The PDF is one polished, single-column, ATS-friendly template with real, selectable text.
- A tailored CV's buttons are disabled, with the reason shown, while it has blocking flags or its profile
  changed since; the server refuses such a CV too.
- Attaching a saved profile file in a later chat restores the profile unchanged.
- Buttons, states, errors and the preview dialog work by keyboard and screen reader (WCAG 2.1 AA, AAA
  text), on phones too.

## Decisions

- **What can be downloaded:** tailored CVs and the plain profile (PDF); the profile as a JSON file.
- **Templates:** one polished template ("modern", Brighte green accent). A second would be a new style
  on the same data.
- **How the PDF is made:** on the server, `POST /api/cv-pdf`, rendering a React template with
  `@react-pdf/renderer`. Chosen over rendering in the browser (≈1 MB more JavaScript, and its WebAssembly
  layout engine would need `'wasm-unsafe-eval'` in the CSP) and over the print dialog (not a real
  download; differs by browser; awkward on phones). The server re-validates and re-runs `tailorCv` on
  what the page sends.
- **Preview:** the same PDF bytes as the download. On desktop in a native `<dialog>` with an `<iframe>`
  (CSP gains `frame-src 'self' blob:`); on phones an "Open the PDF" link once it's ready (a tab opened
  after the wait would be blocked as a popup).
- **Saving the profile:** "Save profile" downloads the parsed profile as JSON, made in the browser.
  Restoring is by attaching that file (`.json` is already an accepted attachment): a prompt rule, no new
  UI.

## The route: `POST /api/cv-pdf`

- **Request:** `content-type: application/json` (else 415), body ≤ 256 KB (else 413), `{ profile:
  unknown, tailored?: unknown }`: the blocks' JSON as they appeared in the chat.
- **Rate limit:** per visitor (same client-IP rules as the chat), 30 per 10 minutes by default,
  `CHAT_PDF_RATE_LIMIT` overrides the count (window shared with `CHAT_RATE_LIMIT_WINDOW_SECONDS`) →
  429 with `retryAfterSeconds`.
- **Validation:** `profile` through `profileBlockSchema`, `tailored` through `tailoredBlockSchema`
  (both with the blank-stripping parse) → 400 when either fails.
- **Tailored:** `tailorCv(profile, tailored)` on the server; any blocking flag → 409. The PDF is the
  merged CV. Without `tailored`, the PDF is the profile.
- **Characters:** text is NFC-normalised and common typographic characters are mapped to what the
  font has (→ "->", − "-", non-breaking hyphens "-", ●▪ "•", ≥ ">=", zero-width characters and CR
  dropped). Anything still outside the standard fonts (WinAnsi) → 422 with those characters
  (`characters`, up to 10), named in the message. No PDF with blank gaps.
- **Response:** `200 application/pdf`, `Content-Disposition: attachment; filename="…"`, `cache-control:
  no-store`. Filenames: `{Name}-CV.pdf`; tailored `{Name}-CV-{Employer or Title}.pdf`, with
  non-alphanumerics collapsed to `-`.
- **Errors:** JSON `{ code }` (`BAD_REQUEST`, `TOO_LARGE`, `RATE_LIMITED`, `HAS_BLOCKING_FLAGS`,
  `UNSUPPORTED_CHARACTERS`, `RENDER_FAILED`), turned into words on the page.

## The template (`src/lib/cv-pdf/`, server-only)

`CvDocument` (react-pdf `Document`/`Page`/`View`/`Text`/`Link`) and `renderCvPdf(cv: Profile):
Promise<Buffer>`. A new `src/lib` folder: `server.ts` barrel, added to `LIB_BARRELS`.

- **Page:** A4, 18 mm margins, one column, Helvetica (built into PDF).
- **Header:** name 22pt bold in the accent; headline 11pt; contact line 9pt grey (location · email ·
  phone); links as clickable text without `https://`.
- **Sections** (Summary, Experience, Projects, Education, Skills, Certificates, Languages; empty ones
  left out): heading 9pt uppercase, letter-spaced, accent colour, thin accent rule.
- **Experience:** position bold 10.5pt with dates right-aligned on the same line ("Mar 2021 – Present",
  the preview's date rules); employer · location 9.5pt grey; role summary; bullets 10pt with a hanging
  indent. Role skill badges are not printed (the Skills section covers skills).
- **Projects:** name bold (linked if it has a URL), description, bullets.
- **Education:** "Qualification, Field · Institution" with dates on the right (a lone end year is the
  year, as in the preview).
- **Skills:** "Group: a, b, c" rows, or the keywords alone. **Certificates:** "Name · Issuer · Date".
  **Languages:** "English (Native), Mandarin".
- **Footer:** "Page N of M" 8pt grey, only when there is more than one page.
- **Colour:** accent `#00805c` (the text-safe brand green); body near-black, secondary dark grey (both
  well above 7:1 on white).
- **Breaks:** a role's title line stays with its first bullet; a section heading never ends a page.

## In the chat

- **`CvActions`:** `{ downloadPdf(source), previewPdf(source), saveProfile(profile) }` with `source = {
  profile, tailored? }`, provided by the chat page (`Chat.tsx`) to `ChatWindow`, which passes it on
  through `ChatBubble`'s `BlockContext`. Cards stay presentational: they get callbacks and state.
- **`ProfilePreview`:** an optional actions row (Preview PDF, Download PDF, Save profile). Shown in the
  chat; not when it renders inside `TailoredCv` (that card has its own).
- **`TailoredCv`:** Preview PDF and Download PDF. Disabled while there are blocking flags, with "Fix {N}
  thing(s) before downloading" next to them (the profile-changed flag counts as blocking). The source
  sent is the profile the tailored CV was written from, the one it was checked against.
- **States** (next to the buttons, `aria-live="polite"`): busy "Preparing PDF…" (buttons disabled,
  `aria-busy`); 409 "Fix the things to check first."; 422 "This CV has characters the PDF font can't
  show yet (for example Chinese). Download isn't available for it."; 429 "You've made a lot of PDFs. Try
  again in {N} minutes."; anything else "The PDF couldn't be made. Please try again."
- **Downloads:** the PDF blob, and the profile JSON (`{Name}-profile.json`, pretty-printed), saved via a
  temporary object URL and an `<a download>`.
- **Preview dialog:** native `<dialog>` with the PDF in an `<iframe>` (title "CV preview"), a Close
  button, Escape closes it, focus returns to the Preview button. Phones (`< sm`) open a new tab instead.

## Persona

- **Restore:** "When the visitor attaches a saved profile (a JSON file in the profile format), use it as
  their profile: write one sentence and the profile block with it unchanged; don't extract again."

## Testing

- **Unit (Vitest):** route handler: profile → 200 PDF (`%PDF-` header, filename); tailored with no
  blocking flags → 200, merged CV; with blocking flags → 409; bad JSON or schema → 400; > 256 KB → 413;
  not JSON → 415; rate limit → 429; unsupported characters → 422; filename rules. `renderCvPdf`: the
  PDF's text contains the name, a role line, a date range and a bullet. Character check: Latin-1,
  curly quotes, dashes pass; CJK and emoji fail. Persona restore rule.
- **Stories (Chromium + axe):** profile card with actions; tailored CV actions enabled and disabled
  with the reason; busy and error states; the preview dialog's focus behaviour.
- **e2e:** `[profile]` → Download PDF (download event, `.pdf` name, `%PDF-` bytes); `[tailored]` (a
  blocking flag) → buttons disabled with the reason; a clean tailored mock → download works; preview
  opens and closes; Save profile → JSON that parses with the profile schema; no CSP violations during
  preview.
- **Manual:** the sample CV: both PDFs downloaded and looked at (including two pages); the saved JSON
  attached in a fresh chat restores the profile; screenshots.
- **Definition of done:** `pnpm lint && pnpm lint:style && pnpm typecheck`, all web tests, chat and
  security e2e, Lighthouse on `/chat`.

## Out of scope

- A second template or a style picker; non-Latin scripts (would need an embedded font); DOCX; editing
  the CV before download; storing anything on the server.
