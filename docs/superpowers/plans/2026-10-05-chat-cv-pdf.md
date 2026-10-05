# Chat CV PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download the profile or a tailored CV as a polished PDF (rendered on the server, refused while blocking flags remain), preview it, and save the profile as JSON; restore it by attaching the file.

**Architecture:** `src/lib/cv-pdf/` (new lib folder): a react-pdf template (`CvDocument`), `renderCvPdf`, a WinAnsi character check, and `handleCvPdf` (the route's logic, deps injected, like `handleChat`). `POST /api/cv-pdf` wires it. Date formatting moves from `ProfilePreview` to `src/lib/chat/cv-format.ts` so the preview and the PDF agree. The chat page owns the browser side (`cv-files.ts`: fetch, download, preview, save) and hands `CvActions` down through `ChatWindow` and `ChatBubble`'s `BlockContext` to the cards.

**Tech Stack:** Next.js 16 route handler (Node runtime), `@react-pdf/renderer` 4.9 (installed in the spike), React 19, Zod 4, Storybook 10 + Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-chat-cv-pdf-design.md`

## Global Constraints

- Shell: `export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH;` first. pnpm only. Never commit/push/PR unless asked; tasks end with checks.
- Branch `feat/chat-cv-pdf` (stacked on `feat/chat-tailored-cv`, PR #64). **Retarget the PR to `main` as soon as #64 merges** (memory: retarget-stacked-prs).
- `apps/web/CLAUDE.md` rules. New lib folder `cv-pdf` gets `index.ts` (browser-safe: types, error copy) and `server.ts` (`import "server-only"`: renderer, handler) and is added to `LIB_BARRELS` in `eslint.config.mjs`.
- Spike results (done): `renderToBuffer` works in Node and gives `%PDF-1.3`; text can be read back by inflating FlateDecode streams and decoding the `<hex>` strings as Windows-1252; "–", "·", curly quotes, "é", "…", "€" render; CJK does not (garbage), hence the 422 check.
- Limits: body ≤ 256 KB → 413; rate limit 30 per window (`CHAT_PDF_RATE_LIMIT`; window `CHAT_RATE_LIMIT_WINDOW_SECONDS`, default 600) → 429.
- Error codes: `BAD_REQUEST` (400/415), `TOO_LARGE` (413), `RATE_LIMITED` (429, `retryAfterSeconds`), `HAS_BLOCKING_FLAGS` (409), `UNSUPPORTED_CHARACTERS` (422), `RENDER_FAILED` (500).
- Copy: buttons "Preview PDF", "Download PDF", "Save profile"; reason "Fix 1 thing before downloading" / "Fix {N} things before downloading"; busy "Preparing PDF…"; errors: 409 "Fix the things to check first."; 422 "This CV has characters the PDF font can't show yet (for example Chinese). Download isn't available for it."; 429 "You've made a lot of PDFs. Try again in {N} minute(s)."; other "The PDF couldn't be made. Please try again."; dialog title "CV preview", button "Close".
- Filenames: `{Name}-CV.pdf`, `{Name}-CV-{Employer or Title}.pdf`, `{Name}-profile.json`; non-alphanumerics (Unicode letters/digits kept) collapsed to `-`, trimmed of `-`.
- Template numbers: A4; margins 18 mm (51pt); name 22pt bold accent `#00805c`; headline 11pt; contact 9pt `#4d5866`; section heading 9pt uppercase letter-spacing 1, accent, rule 0.75pt accent; position 10.5pt bold; employer line 9.5pt `#4d5866`; body/bullets 10pt `#1e2028`; footer 8pt `#4d5866`.

## Review Focus

- A tailored source whose `profile` is a *different* profile than the one the card was checked against (e.g. a modified browser sends the newest profile): the server re-runs `tailorCv` on what it receives, so blocking flags are judged on that pair; expect 409 when refs break, never a PDF with misattributed bullets. Pinned in Task 3.
- A profile with an emoji or a Chinese name: expect 422 and the explanation, not a PDF with garbage. Pinned in Task 1 (check) and Task 3 (route).
- A very long CV (10 roles × 10 bullets): expect a multi-page PDF with "Page N of M", no crash. Pinned in Task 2.
- Clicking Download twice quickly: expect one request at a time (button disabled while busy). Pinned in Task 5 (story).
- Preview on a phone width: expect a new tab rather than a cramped iframe dialog. Pinned in Task 5/6.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/chat/cv-format.ts` (+ test) | Create | `formatDate`, `dateRange`, `educationDates` (shared by preview and PDF) |
| `apps/web/src/components/molecules/ProfilePreview/ProfilePreview.tsx` | Modify | Use `cv-format`; optional `actions` slot |
| `apps/web/src/lib/cv-pdf/characters.ts` (+ test) | Create | WinAnsi check: `unsupportedCharacters(cv)` |
| `apps/web/src/lib/cv-pdf/filenames.ts` (+ test) | Create | `cvFilename`, `profileFilename` |
| `apps/web/src/lib/cv-pdf/errors.ts` | Create | `CvPdfErrorCode`, `cvPdfErrorMessage(body)` |
| `apps/web/src/lib/cv-pdf/CvDocument.tsx`, `render.ts` (+ test, `pdf-text.ts` test helper) | Create | Template and `renderCvPdf` |
| `apps/web/src/lib/cv-pdf/handle-cv-pdf.ts` (+ test) | Create | The route's logic |
| `apps/web/src/lib/cv-pdf/index.ts`, `server.ts` | Create | Barrels |
| `apps/web/src/app/api/cv-pdf/route.ts` | Create | Wiring |
| `apps/web/src/lib/chat/config.ts` (+ test) | Modify | `pdfRateLimit` |
| `apps/web/src/lib/security-headers.ts` (+ test) | Modify | `frame-src 'self' blob:` |
| `apps/web/eslint.config.mjs`, `next.config.ts` | Modify | `LIB_BARRELS`; `serverExternalPackages` if the build needs it |
| `apps/web/src/app/chat/_components/cv-files.ts` | Create | Browser: fetch PDF, download blob, open preview, save JSON |
| `apps/web/src/components/molecules/CvButtons/*` | Create | Buttons row with busy/error state |
| `apps/web/src/components/molecules/PdfPreviewDialog/*` | Create | `<dialog>` with the PDF |
| `ChatBubble`, `ChatWindow`, `Chat.tsx`, `TailoredCv` (+ stories) | Modify | Thread `CvActions` and render the buttons |
| `apps/web/src/lib/chat/personas.ts` (+ test) | Modify | Restore rule |
| `apps/web/e2e/chat.spec.ts`, `security.spec.ts`, `mock-llm.mjs` | Modify | Downloads, preview, save, CSP |

---

### Task 1: Shared date formatting, character check, filenames, error copy

**Files:** create `src/lib/chat/cv-format.ts` + `cv-format.test.ts`; `src/lib/cv-pdf/characters.ts` + test; `src/lib/cv-pdf/filenames.ts` + test; `src/lib/cv-pdf/errors.ts`; `src/lib/cv-pdf/index.ts`; modify `ProfilePreview.tsx`, `src/lib/chat/index.ts`, `eslint.config.mjs` (`LIB_BARRELS` += `"cv-pdf"`).

**Interfaces (produces):**
- `@/lib/chat`: `formatDate(date: string): string`, `dateRange(start?: string, end?: string): string | undefined`, `educationDates(start?: string, end?: string): string | undefined` (a lone end year is the year).
- `@/lib/cv-pdf` (browser-safe): `unsupportedCharacters(cv: Profile): string[]`, `cvFilename(cv: Profile, job?: { title: string; employer?: string }): string`, `profileFilename(profile: Profile): string`, `type CvPdfErrorCode`, `type CvPdfErrorBody = { code: CvPdfErrorCode; retryAfterSeconds?: number }`, `cvPdfErrorMessage(body: CvPdfErrorBody): string`.

- [ ] **Step 1: Failing tests**

`cv-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dateRange, educationDates, formatDate } from "./cv-format";

describe("cv dates", () => {
  it.each([
    ["2019", "2019"],
    ["2019-03", "Mar 2019"],
    ["present", "Present"],
  ])("formats %j as %j", (date, shown) => expect(formatDate(date)).toBe(shown));

  it.each([
    ["2021-03", "present", "Mar 2021 – Present"],
    ["2017", "2021", "2017 – 2021"],
    ["2019", undefined, "From 2019"],
    [undefined, "2020", "Until 2020"],
    [undefined, "present", "Present"],
    [undefined, undefined, undefined],
  ])("dateRange(%j, %j) is %j", (start, end, shown) => expect(dateRange(start, end)).toBe(shown));

  it("shows a degree's lone end year as the year", () => {
    expect(educationDates(undefined, "2016")).toBe("2016");
    expect(educationDates("2013", "2016")).toBe("2013 – 2016");
  });
});
```

`src/lib/cv-pdf/characters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { unsupportedCharacters } from "./characters";

const cv = (summary: string) => ({ basics: { name: "Jane Citizen", summary } });

describe("unsupportedCharacters", () => {
  it("accepts Western European text and the punctuation the template uses", () => {
    expect(unsupportedCharacters(cv("Café – Zürich · “quoted” ‘single’ … € • — ñ ø ß"))).toEqual([]);
  });

  it.each([
    ["Chinese", "中文", ["中", "文"]],
    ["an emoji", "Team player 🚀", ["🚀"]],
    ["Cyrillic", "Москва", ["М", "о", "с", "к", "в", "а"]],
  ])("finds %s", (_, text, found) => {
    expect(unsupportedCharacters(cv(text))).toEqual(found);
  });

  it("checks every field, and lists each character once", () => {
    expect(unsupportedCharacters({ basics: { name: "王 王" }, work: [{ employer: "東京", position: "Dev" }] })).toEqual(["王", "東", "京"]);
  });
});
```

`src/lib/cv-pdf/filenames.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cvFilename, profileFilename } from "./filenames";

const jane = { basics: { name: "Jane Citizen" } };

describe("filenames", () => {
  it("names the profile's PDF and JSON", () => {
    expect(cvFilename(jane)).toBe("Jane-Citizen-CV.pdf");
    expect(profileFilename(jane)).toBe("Jane-Citizen-profile.json");
  });

  it("names a tailored CV after the employer, else the job title", () => {
    expect(cvFilename(jane, { title: "Senior Engineer", employer: "Brightpath Fintech" })).toBe("Jane-Citizen-CV-Brightpath-Fintech.pdf");
    expect(cvFilename(jane, { title: "Senior Engineer" })).toBe("Jane-Citizen-CV-Senior-Engineer.pdf");
  });

  it("keeps letters in any script but collapses punctuation", () => {
    expect(cvFilename({ basics: { name: "  José O'Brien-Smith!! " } })).toBe("José-O-Brien-Smith-CV.pdf");
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `cd apps/web && pnpm exec vitest run --project unit src/lib/chat/cv-format.test.ts src/lib/cv-pdf` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/lib/chat/cv-format.ts` (move from `ProfilePreview.tsx`, then import it there):

```ts
// How CV dates read, the same in the chat preview and the PDF.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2019" stays "2019", "2019-03" is "Mar 2019", "present" is "Present". */
export function formatDate(date: string): string {
  if (date === "present") return "Present";
  const [year, month] = date.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

/** A role's dates: "Mar 2021 – Present", "From 2019", "Until 2020". */
export function dateRange(start?: string, end?: string): string | undefined {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return end === "present" ? "Present" : `Until ${formatDate(end)}`;
  return undefined;
}

/** A qualification's dates: an end year alone is when it was completed ("2016", not "Until 2016"). */
export function educationDates(start?: string, end?: string): string | undefined {
  return start ? dateRange(start, end) : end && formatDate(end);
}
```

Export from `src/lib/chat/index.ts`: `export { dateRange, educationDates, formatDate } from "./cv-format";`. In `ProfilePreview.tsx`, delete its `MONTHS`, `formatDate` and `dateRange`, import `{ dateRange, educationDates, formatDate }` from `@/lib/chat` (merge with the existing `type Profile` import), and replace the education line `const dates = item.start ? dateRange(item.start, item.end) : item.end && formatDate(item.end);` with `const dates = educationDates(item.start, item.end);`.

`src/lib/cv-pdf/characters.ts`:

```ts
import type { Profile } from "../chat";

// The PDF uses the standard Helvetica font, which only has the Windows-1252 (WinAnsi) characters:
// Latin-1 plus a few typographic ones. Anything else (Chinese, Cyrillic, emoji) would come out as
// garbage, so such a CV is refused with an explanation instead.

const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const supported = (char: string) => {
  const code = char.codePointAt(0)!;
  return code === 0x0a || code === 0x09 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char);
};

/** Every string in the CV. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
}

/** The CV's characters the PDF font can't show, each once, in order of appearance. */
export function unsupportedCharacters(cv: Profile): string[] {
  const found = new Set<string>();
  for (const text of strings(cv)) for (const char of text) if (!supported(char)) found.add(char);
  return [...found];
}
```

(Note `for (const char of text)` iterates code points, so an emoji is one character.)

`src/lib/cv-pdf/filenames.ts`:

```ts
import type { Profile } from "../chat";

/** Letters and digits in any script kept; everything else collapsed to "-". */
const slug = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

export function cvFilename(cv: Profile, job?: { title: string; employer?: string }): string {
  const target = job ? `-${slug(job.employer ?? job.title)}` : "";
  return `${slug(cv.basics.name)}-CV${target}.pdf`;
}

export function profileFilename(profile: Profile): string {
  return `${slug(profile.basics.name)}-profile.json`;
}
```

`src/lib/cv-pdf/errors.ts`:

```ts
// The PDF route's error codes and how the page says them. Browser-safe.

export type CvPdfErrorCode = "BAD_REQUEST" | "TOO_LARGE" | "RATE_LIMITED" | "HAS_BLOCKING_FLAGS" | "UNSUPPORTED_CHARACTERS" | "RENDER_FAILED";
export type CvPdfErrorBody = { code: CvPdfErrorCode; retryAfterSeconds?: number };

export function cvPdfErrorMessage({ code, retryAfterSeconds = 60 }: CvPdfErrorBody): string {
  switch (code) {
    case "HAS_BLOCKING_FLAGS":
      return "Fix the things to check first.";
    case "UNSUPPORTED_CHARACTERS":
      return "This CV has characters the PDF font can't show yet (for example Chinese). Download isn't available for it.";
    case "RATE_LIMITED": {
      const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return `You've made a lot of PDFs. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    default:
      return "The PDF couldn't be made. Please try again.";
  }
}
```

`src/lib/cv-pdf/index.ts`:

```ts
// Public API of the CV PDF feature that is safe anywhere, the browser included: filenames, the
// character check and error copy. The renderer and the route's logic are in ./server.
export { unsupportedCharacters } from "./characters";
export { cvPdfErrorMessage, type CvPdfErrorBody, type CvPdfErrorCode } from "./errors";
export { cvFilename, profileFilename } from "./filenames";
```

`eslint.config.mjs`: add `"cv-pdf"` to the `LIB_BARRELS` list.

Add a unit test for the message copy to `filenames.test.ts`? No — put it in `src/lib/cv-pdf/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cvPdfErrorMessage } from "./errors";

describe("cvPdfErrorMessage", () => {
  it("says how long to wait when rate limited", () => {
    expect(cvPdfErrorMessage({ code: "RATE_LIMITED", retryAfterSeconds: 30 })).toBe("You've made a lot of PDFs. Try again in 1 minute.");
    expect(cvPdfErrorMessage({ code: "RATE_LIMITED", retryAfterSeconds: 301 })).toBe("You've made a lot of PDFs. Try again in 6 minutes.");
  });
  it("explains blocking flags and unsupported characters", () => {
    expect(cvPdfErrorMessage({ code: "HAS_BLOCKING_FLAGS" })).toBe("Fix the things to check first.");
    expect(cvPdfErrorMessage({ code: "UNSUPPORTED_CHARACTERS" })).toMatch(/^This CV has characters/);
  });
  it("falls back to a generic message", () => {
    expect(cvPdfErrorMessage({ code: "RENDER_FAILED" })).toBe("The PDF couldn't be made. Please try again.");
  });
});
```

- [ ] **Step 4: Run** — `pnpm exec vitest run --project unit src/lib/chat src/lib/cv-pdf` → PASS; `pnpm exec vitest run --project storybook src/components/molecules/ProfilePreview` → PASS (no behaviour change).
- [ ] **Step 5: Checks** — repo root `pnpm lint && pnpm typecheck`.

---

### Task 2: The PDF template and `renderCvPdf`

**Files:** create `src/lib/cv-pdf/CvDocument.tsx`, `src/lib/cv-pdf/render.ts`, `src/lib/cv-pdf/render.test.ts`, `src/lib/cv-pdf/pdf-text.ts` (test helper), `src/lib/cv-pdf/server.ts`.

**Interfaces:** `renderCvPdf(cv: Profile): Promise<Buffer>` (server). Test helper `pdfText(buffer: Buffer): string`, `pdfPageCount(buffer: Buffer): number`.

- [ ] **Step 1: Failing test** — `render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Profile } from "../chat";
import { pdfPageCount, pdfText } from "./pdf-text";
import { renderCvPdf } from "./render";

const cv: Profile = {
  basics: {
    name: "Jane Citizen",
    headline: "Senior Front-end Engineer",
    email: "jane@example.com",
    location: { city: "Sydney", region: "NSW" },
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
      highlights: ["Led the React rebuild of the loan portal (40k monthly users)."],
      skills: ["React"],
    },
  ],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ group: "Front-end", keywords: ["React", "TypeScript"] }],
};

describe("renderCvPdf", () => {
  it("renders a PDF with the CV's text, in the preview's wording", async () => {
    const pdf = await renderCvPdf(cv);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdfText(pdf);
    for (const expected of [
      "Jane Citizen",
      "Senior Front-end Engineer",
      "Sydney, NSW · jane@example.com",
      "github.com/jane",
      "EXPERIENCE",
      "Mar 2021 – Present",
      "Acme Lending · Sydney",
      "Led the React rebuild of the loan portal (40k monthly users).",
      "BSc, Computer Science · University of Sydney",
      "2016",
      "Front-end: React, TypeScript",
    ]) {
      expect(text).toContain(expected);
    }
    // Role skills are covered by the Skills section, not printed as badges.
    expect(text.match(/React/g)?.length).toBe(3);
    expect(pdfPageCount(pdf)).toBe(1);
    expect(text).not.toContain("Page 1 of");
  });

  it("numbers the pages of a long CV", async () => {
    const long: Profile = {
      basics: { name: "Jane Citizen" },
      work: Array.from({ length: 10 }, (_, i) => ({
        employer: `Employer ${i + 1}`,
        position: "Engineer",
        start: "2010",
        end: "2011",
        highlights: Array.from({ length: 10 }, (_, j) => `Did a substantial and well-described thing number ${j + 1} for this employer.`),
      })),
    };
    const pdf = await renderCvPdf(long);
    const pages = pdfPageCount(pdf);
    expect(pages).toBeGreaterThan(1);
    expect(pdfText(pdf)).toContain(`Page 1 of ${pages}`);
  });
});
```

`pdf-text.ts` (test helper; plain module, not exported from the barrels):

```ts
import { inflateSync } from "node:zlib";

// For tests: the text a react-pdf PDF shows. Its content streams are Flate-compressed and draw text
// as <hex> strings in the standard fonts' Windows-1252 encoding.

export function pdfText(pdf: Buffer): string {
  const source = pdf.toString("latin1");
  const decoder = new TextDecoder("windows-1252");
  const parts: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    // Each text object (BT … ET) on its own line, its strings joined.
    for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
      parts.push([...block[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((hex) => decoder.decode(Buffer.from(hex[1], "hex"))).join(""));
    }
  }
  return parts.join("\n");
}

export function pdfPageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
}
```

If a line of the template is drawn as several text objects (react-pdf may split words into runs), `toContain` on a joined phrase can fail: then join runs with "" inside a line and compare on the space-normalised text (`text.replace(/\s+/g, " ")`); ledger it.

- [ ] **Step 2: Run** — `pnpm exec vitest run --project unit src/lib/cv-pdf/render.test.ts` → FAIL (no `./render`).

- [ ] **Step 3: Implement** — `CvDocument.tsx`:

```tsx
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { dateRange, educationDates, formatDate, type Profile } from "../chat";

// The CV template: one column, ATS-friendly (real text, standard headings, no tables or graphics),
// Helvetica (built into PDF), A4. Wording follows the chat's ProfilePreview.

const ACCENT = "#00805c";
const TEXT = "#1e2028";
const MUTED = "#4d5866";

const styles = StyleSheet.create({
  page: { paddingVertical: 51, paddingHorizontal: 51, fontFamily: "Helvetica", fontSize: 10, color: TEXT, lineHeight: 1.35 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: ACCENT },
  headline: { fontSize: 11, marginTop: 2 },
  contact: { fontSize: 9, color: MUTED, marginTop: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, fontSize: 9 },
  link: { color: ACCENT, marginRight: 12, textDecoration: "none" },
  section: { marginTop: 14 },
  heading: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 1, textTransform: "uppercase", paddingBottom: 2, borderBottomWidth: 0.75, borderBottomColor: ACCENT, marginBottom: 6 },
  entry: { marginBottom: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontSize: 10.5, fontFamily: "Helvetica-Bold", flexShrink: 1, paddingRight: 8 },
  dates: { fontSize: 9.5, color: MUTED },
  subtitle: { fontSize: 9.5, color: MUTED },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
  footer: { position: "absolute", bottom: 24, left: 51, right: 51, fontSize: 8, color: MUTED, textAlign: "right" },
});

const join = (parts: (string | undefined)[], separator = " · ") => parts.filter(Boolean).join(separator);
const bare = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {/* minPresenceAhead: the heading never ends a page alone. */}
      <Text style={styles.heading} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items?: string[] }) {
  return (items ?? []).map((item, index) => (
    <View key={index} style={styles.bullet}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

function Entry({ title, dates, subtitle, summary, bullets }: { title: ReactNode; dates?: string; subtitle?: string; summary?: string; bullets?: string[] }) {
  return (
    <View style={styles.entry}>
      {/* The title line stays with what follows it. */}
      <View style={styles.titleRow} minPresenceAhead={30}>
        <Text style={styles.title}>{title}</Text>
        {dates ? <Text style={styles.dates}>{dates}</Text> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {summary ? <Text style={{ marginTop: 2 }}>{summary}</Text> : null}
      <Bullets items={bullets} />
    </View>
  );
}

export function CvDocument({ cv }: { cv: Profile }) {
  const { basics, work, projects, education, skills, certificates, languages } = cv;
  const location = [basics.location?.city, basics.location?.region, basics.location?.country].filter(Boolean).join(", ");
  const contact = join([location, basics.email, basics.phone]);
  return (
    <Document title={`${basics.name} CV`} author={basics.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{basics.name}</Text>
        {basics.headline ? <Text style={styles.headline}>{basics.headline}</Text> : null}
        {contact ? <Text style={styles.contact}>{contact}</Text> : null}
        {basics.links?.length ? (
          <View style={styles.links}>
            {basics.links.map((link, index) => (
              <Link key={index} src={link.url} style={styles.link}>
                {bare(link.url)}
              </Link>
            ))}
          </View>
        ) : null}

        {basics.summary ? (
          <Section title="Summary">
            <Text>{basics.summary}</Text>
          </Section>
        ) : null}

        {work?.length ? (
          <Section title="Experience">
            {work.map((role, index) => (
              <Entry
                key={index}
                title={role.position}
                dates={dateRange(role.start, role.end)}
                subtitle={join([role.employer, role.location])}
                summary={role.summary}
                bullets={role.highlights}
              />
            ))}
          </Section>
        ) : null}

        {projects?.length ? (
          <Section title="Projects">
            {projects.map((project, index) => (
              <Entry
                key={index}
                title={project.url ? <Link src={project.url} style={{ color: TEXT, textDecoration: "none" }}>{project.name}</Link> : project.name}
                summary={project.description}
                bullets={project.highlights}
              />
            ))}
          </Section>
        ) : null}

        {education?.length ? (
          <Section title="Education">
            {education.map((item, index) => {
              const title = [item.qualification, item.field].filter(Boolean).join(", ");
              return (
                <Entry
                  key={index}
                  title={title ? `${title} · ${item.institution}` : item.institution}
                  dates={educationDates(item.start, item.end)}
                  subtitle={item.grade}
                />
              );
            })}
          </Section>
        ) : null}

        {skills?.length ? (
          <Section title="Skills">
            {skills.map((group, index) => (
              <Text key={index} style={{ marginBottom: 2 }}>
                {group.group ? <Text style={{ fontFamily: "Helvetica-Bold" }}>{`${group.group}: `}</Text> : null}
                {group.keywords.join(", ")}
              </Text>
            ))}
          </Section>
        ) : null}

        {certificates?.length ? (
          <Section title="Certificates">
            {certificates.map((item, index) => (
              <Text key={index} style={{ marginBottom: 2 }}>
                {join([item.name, item.issuer, item.date && formatDate(item.date)])}
              </Text>
            ))}
          </Section>
        ) : null}

        {languages?.length ? (
          <Section title="Languages">
            <Text>{languages.map((item) => (item.fluency ? `${item.language} (${item.fluency})` : item.language)).join(", ")}</Text>
          </Section>
        ) : null}

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : "")} />
      </Page>
    </Document>
  );
}
```

Note: `textTransform: "uppercase"` makes the heading text in the PDF "EXPERIENCE" (the test expects that). If react-pdf keeps the source case in the text layer, write the titles uppercase in the component instead and ledger it.

`render.ts`:

```ts
import { renderToBuffer } from "@react-pdf/renderer";
import type { Profile } from "../chat";
import { CvDocument } from "./CvDocument";

/** The CV as PDF bytes. */
export async function renderCvPdf(cv: Profile): Promise<Buffer> {
  return renderToBuffer(<CvDocument cv={cv} />);
}
```

Name it `render.tsx` (it contains JSX). `server.ts`:

```ts
// Server-only public API of the CV PDF feature: the renderer and the route's logic.
import "server-only";

export { renderCvPdf } from "./render";
```

(Task 3 adds `handleCvPdf` here.) The unit test imports `./render` directly, so `server-only` doesn't throw under Vitest. `src/lib/chat` is imported as `../chat` (the folder's browser-safe barrel) — allowed: it's another lib folder's barrel.

- [ ] **Step 4: Run** — `pnpm exec vitest run --project unit src/lib/cv-pdf` → PASS.
- [ ] **Step 5: Checks** — `pnpm lint && pnpm typecheck`.

---

### Task 3: `handleCvPdf`, the route, config and CSP

**Files:** create `src/lib/cv-pdf/handle-cv-pdf.ts` + test, `src/app/api/cv-pdf/route.ts`; modify `src/lib/cv-pdf/server.ts`, `src/lib/chat/config.ts` (+ test), `src/lib/security-headers.ts` (+ test), `.env.example`; `next.config.ts` only if the build fails to bundle react-pdf.

**Interfaces:** `handleCvPdf(request: Request, deps: CvPdfHandlerDeps): Promise<Response>`, `type CvPdfHandlerDeps = { takeRateLimit: (key: string) => RateLimitResult; trustedHops: number; render?: (cv: Profile) => Promise<Buffer> }` (render defaults to `renderCvPdf`; tests may inject a fake). `chatConfig().pdfRateLimit: number` (default 30).

- [ ] **Step 1: Failing tests** — `handle-cv-pdf.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { handleCvPdf, type CvPdfHandlerDeps } from "./handle-cv-pdf";

const profile = {
  basics: { name: "Jane Citizen" },
  work: [{ employer: "Acme Lending", position: "Engineer", highlights: ["Led the React rebuild."] }],
};
const tailored = (from?: number[]) => ({ job: { title: "Senior Engineer", employer: "Brightpath" }, work: [{ role: 0, highlights: [{ text: "Led the React rebuild of the portal.", from }] }] });

const deps = (overrides: Partial<CvPdfHandlerDeps> = {}): CvPdfHandlerDeps => ({
  takeRateLimit: () => ({ ok: true }),
  trustedHops: 1,
  render: vi.fn(async () => Buffer.from("%PDF-1.3 fake")),
  ...overrides,
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/cv-pdf", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("handleCvPdf", () => {
  it("renders the profile as a PDF download", async () => {
    const d = deps();
    const response = await handleCvPdf(post({ profile }), d);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Jane-Citizen-CV.pdf"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString("latin1")).toBe("%PDF-1.3 fake");
    expect(d.render).toHaveBeenCalledWith(expect.objectContaining({ basics: { name: "Jane Citizen" } }));
  });

  it("renders a tailored CV merged by the server", async () => {
    const d = deps();
    const response = await handleCvPdf(post({ profile, tailored: tailored([0]) }), d);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Jane-Citizen-CV-Brightpath.pdf"');
    expect(d.render).toHaveBeenCalledWith(expect.objectContaining({ work: [expect.objectContaining({ employer: "Acme Lending", highlights: ["Led the React rebuild of the portal."] })] }));
  });

  it("refuses a tailored CV with blocking flags", async () => {
    const response = await handleCvPdf(post({ profile, tailored: tailored() }), deps());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "HAS_BLOCKING_FLAGS" });
  });

  it("refuses a tailored CV whose references don't fit the profile sent", async () => {
    const response = await handleCvPdf(post({ profile, tailored: { job: { title: "X" }, work: [{ role: 3 }] } }), deps());
    expect(response.status).toBe(409);
  });

  it.each([
    ["an invalid profile", { profile: { basics: {} } }],
    ["an invalid tailored block", { profile, tailored: { work: [] } }],
    ["no profile", {}],
  ])("rejects %s", async (_, body) => {
    const response = await handleCvPdf(post(body), deps());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "BAD_REQUEST" });
  });

  it("rejects unreadable JSON and other content types", async () => {
    expect((await handleCvPdf(post("{"), deps())).status).toBe(400);
    expect((await handleCvPdf(post({ profile }, { "content-type": "text/plain" }), deps())).status).toBe(415);
  });

  it("rejects a body over 256 KB", async () => {
    const response = await handleCvPdf(post({ profile: { basics: { name: "Jane", summary: "x".repeat(300_000) } } }), deps());
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "TOO_LARGE" });
  });

  it("rate-limits per visitor", async () => {
    const takeRateLimit = vi.fn(() => ({ ok: false as const, retryAfterSeconds: 90 }));
    const response = await handleCvPdf(post({ profile }), deps({ takeRateLimit }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("90");
    expect(await response.json()).toEqual({ code: "RATE_LIMITED", retryAfterSeconds: 90 });
    expect(takeRateLimit).toHaveBeenCalledWith("203.0.113.7");
  });

  it("refuses characters the PDF font can't show", async () => {
    const response = await handleCvPdf(post({ profile: { basics: { name: "王小明" } } }), deps());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "UNSUPPORTED_CHARACTERS" });
  });

  it("reports a render failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleCvPdf(post({ profile }), deps({ render: async () => Promise.reject(new Error("boom")) }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "RENDER_FAILED" });
  });
});
```

Add to `config.test.ts`: defaults expectation gains `pdfRateLimit: 30`; and `it("reads the PDF rate limit", () => expect(chatConfig({ CHAT_PDF_RATE_LIMIT: "5" }).pdfRateLimit).toBe(5));`.

Add to `security-headers.test.ts` (inside the existing CSP describe): `expect(csp["frame-src"]).toBe("'self' blob:");` in the production-policy test (follow that file's existing parsing helper).

- [ ] **Step 2: Run** — `pnpm exec vitest run --project unit src/lib/cv-pdf src/lib/chat/config.test.ts src/lib/security-headers.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `handle-cv-pdf.ts`:

```ts
import { clientIp } from "../api";
import { parseProfileBlock, parseTailoredBlock, tailorCv, type Profile, type RateLimitResult } from "../chat";
import { unsupportedCharacters } from "./characters";
import type { CvPdfErrorBody } from "./errors";
import { cvFilename } from "./filenames";
import { renderCvPdf } from "./render";

export type CvPdfHandlerDeps = {
  takeRateLimit: (key: string) => RateLimitResult;
  /** Proxies whose X-Forwarded-For entries are trusted (WEB_TRUST_PROXY). */
  trustedHops: number;
  render?: (cv: Profile) => Promise<Buffer>;
};

const MAX_BODY_BYTES = 256 * 1024;

const error = (status: number, body: CvPdfErrorBody, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/**
 * POST /api/cv-pdf: `{ profile, tailored? }` as the blocks' JSON from the chat. Both are checked again
 * here, and a tailored CV is merged here with tailorCv: a browser can't get a PDF of a CV with
 * blocking flags (broken references, claims with no source) by sending a finished CV.
 */
export async function handleCvPdf(request: Request, deps: CvPdfHandlerDeps): Promise<Response> {
  // JSON only: a cross-site page can't send that without a CORS preflight, which this route never allows.
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error(415, { code: "BAD_REQUEST" });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return error(413, { code: "TOO_LARGE" });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return error(413, { code: "TOO_LARGE" });

  let body: { profile?: unknown; tailored?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return error(400, { code: "BAD_REQUEST" });
  }
  const profile = body && typeof body === "object" ? parseProfileBlock(JSON.stringify(body.profile ?? null)) : undefined;
  const tailored = body?.tailored === undefined ? undefined : parseTailoredBlock(JSON.stringify(body.tailored));
  if (!profile || (body.tailored !== undefined && !tailored)) return error(400, { code: "BAD_REQUEST" });

  const visitor = clientIp(request.headers.get("x-forwarded-for"), deps.trustedHops) ?? "unknown";
  const limit = deps.takeRateLimit(visitor);
  if (!limit.ok) {
    return error(429, { code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { "retry-after": String(limit.retryAfterSeconds) });
  }

  let cv = profile;
  if (tailored) {
    const result = tailorCv(profile, tailored);
    if (result.flags.some((flag) => flag.level === "blocking")) return error(409, { code: "HAS_BLOCKING_FLAGS" });
    cv = result.cv;
  }
  if (unsupportedCharacters(cv).length > 0) return error(422, { code: "UNSUPPORTED_CHARACTERS" });

  let pdf: Buffer;
  try {
    pdf = await (deps.render ?? renderCvPdf)(cv);
  } catch (cause) {
    console.error("Rendering a CV PDF failed:", cause);
    return error(500, { code: "RENDER_FAILED" });
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${cvFilename(cv, tailored?.job)}"`,
      "cache-control": "no-store",
    },
  });
}
```

Check before writing: `RateLimitResult` and `parseProfileBlock`/`parseTailoredBlock`/`tailorCv` are exported from `src/lib/chat/index.ts` (add `type RateLimitResult` there if it's only in `server.ts`: it's a pure type, browser-safe); `clientIp` is exported from `src/lib/api/index.ts` (it is). Order note: validation before the rate limit, as `handleChat` does (only requests that will do work count).

The filename can contain non-ASCII letters (José): `Content-Disposition` header values must be ByteString in `Response` (Latin-1 only). Use `filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}` where `asciiFallback` replaces non-Latin-1 characters with `-`; update the two filename expectations in the test to the full header form only if needed — prefer keeping `filename="Jane-Citizen-CV.pdf"` exact for ASCII names by emitting `filename*` only when the name isn't ASCII. Ledger the choice.

`server.ts` += `export { handleCvPdf, type CvPdfHandlerDeps } from "./handle-cv-pdf";`.

`config.ts` += `pdfRateLimit: positiveInt(env, "CHAT_PDF_RATE_LIMIT", 30),` with the doc comment `/** CV PDFs one visitor may make per window (CHAT_RATE_LIMIT_WINDOW_SECONDS). */`.

`security-headers.ts`: add `"frame-src 'self' blob:",` after `"object-src 'none'",` with the comment `// The CV preview shows the PDF (a blob: URL the page made) in a frame.`

`.env.example`: after the `CHAT_RATE_LIMIT_WINDOW_SECONDS` line add `# CV PDFs one visitor may make per window.` and `# CHAT_PDF_RATE_LIMIT=30`.

`src/app/api/cv-pdf/route.ts`:

```ts
import { chatConfig, createRateLimiter } from "@/lib/chat/server";
import { handleCvPdf } from "@/lib/cv-pdf/server";

// Settings are read once, when the server starts (root .env).
const config = chatConfig();
const takeRateLimit = createRateLimiter({ limit: config.pdfRateLimit, windowMs: config.rateLimitWindowSeconds * 1000 });

/** A CV (the profile, or a tailored CV checked again here) as a PDF download. */
export function POST(request: Request) {
  return handleCvPdf(request, { takeRateLimit, trustedHops: Number(process.env.WEB_TRUST_PROXY ?? 0) });
}
```

- [ ] **Step 4: Run** — unit tests → PASS. Then `pnpm --filter @brighte/web build`: if it fails on `@react-pdf/renderer` (bundling, `canvas`, ESM), add `serverExternalPackages: ["@react-pdf/renderer"]` to `next.config.ts` and rebuild; ledger it. Then smoke-test: `WEB_PORT=3201 pnpm start` (background) and `curl -s -o /tmp/claude-502/cv.pdf -w "%{http_code} %{content_type}\n" -H 'content-type: application/json' -d '{"profile":{"basics":{"name":"Jane Citizen"}}}' http://localhost:3201/api/cv-pdf` → `200 application/pdf`; `head -c 5 /tmp/claude-502/cv.pdf` → `%PDF-`. Stop the server.
- [ ] **Step 5: Checks** — `pnpm lint && pnpm typecheck`.

---

### Task 4: Browser side: fetch, download, preview, save (`cv-files.ts`) and the restore rule

**Files:** create `src/app/chat/_components/cv-files.ts`; modify `src/lib/chat/personas.ts` (+ test).

**Interfaces:** `type CvSource = { profile: Profile; tailored?: TailoredBlock }` and `type CvActions = { downloadPdf(source: CvSource): Promise<string | undefined>; previewPdf(source: CvSource): Promise<{ url: string } | { error: string }>; saveProfile(profile: Profile): void }` exported from `@/lib/cv-pdf` (types only, browser-safe; add to `index.ts`). `downloadPdf` resolves to an error message or undefined.

- [ ] **Step 1: Failing test (persona)** — in `personas.test.ts`:

```ts
  it("restores a saved profile file as is", () => {
    expect(getPersona("career").system).toMatch(/saved profile.*unchanged.*don't extract again/is);
  });
```

Run → FAIL. Add to the career prompt, right after the profile-correction bullet:

```
- When the visitor attaches a saved profile (a JSON file in the profile format), use it as their profile: write one sentence, then the profile block with it unchanged; don't extract again.
```

Run `pnpm exec vitest run --project unit src/lib/chat` → PASS.

- [ ] **Step 2: Types** — `src/lib/cv-pdf/actions.ts`:

```ts
import type { Profile, TailoredBlock } from "../chat";

/** What a PDF is made from: the profile, and a tailored block when it's a tailored CV. */
export type CvSource = { profile: Profile; tailored?: TailoredBlock };

/** What the chat's CV cards can do: provided by the chat page, used through ChatWindow and ChatBubble. */
export type CvActions = {
  /** Downloads the PDF; resolves to an error message, or undefined when it worked. */
  downloadPdf(source: CvSource): Promise<string | undefined>;
  /** Makes the PDF for a preview: its object URL (the caller revokes it), or an error message. */
  previewPdf(source: CvSource): Promise<{ url: string } | { error: string }>;
  saveProfile(profile: Profile): void;
};
```

`index.ts` += `export type { CvActions, CvSource } from "./actions";`.

- [ ] **Step 3: Implement** — `src/app/chat/_components/cv-files.ts`:

```ts
import { cvPdfErrorMessage, profileFilename, type CvActions, type CvPdfErrorBody, type CvSource } from "@/lib/cv-pdf";

/** Saves a blob under a file name: a temporary object URL and a clicked <a download>. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the download start before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The file name from Content-Disposition (filename*= first, then filename=). */
function filenameOf(response: Response, fallback: string) {
  const header = response.headers.get("content-disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
}

async function fetchPdf(source: CvSource): Promise<{ blob: Blob; filename: string } | { error: string }> {
  let response: Response;
  try {
    response = await fetch("/api/cv-pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source) });
  } catch {
    return { error: cvPdfErrorMessage({ code: "RENDER_FAILED" }) };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ code: "RENDER_FAILED" }))) as CvPdfErrorBody;
    return { error: cvPdfErrorMessage(body) };
  }
  return { blob: await response.blob(), filename: filenameOf(response, "CV.pdf") };
}

/** The chat page's CV actions (browser only). */
export const cvActions: CvActions = {
  async downloadPdf(source) {
    const result = await fetchPdf(source);
    if ("error" in result) return result.error;
    saveBlob(result.blob, result.filename);
    return undefined;
  },
  async previewPdf(source) {
    const result = await fetchPdf(source);
    if ("error" in result) return result;
    return { url: URL.createObjectURL(new Blob([result.blob], { type: "application/pdf" })) };
  },
  saveProfile(profile) {
    saveBlob(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }), profileFilename(profile));
  },
};
```

(Exercised in e2e, Task 6: real downloads; no unit test, it's DOM/fetch glue.)

- [ ] **Step 4: Checks** — `pnpm lint && pnpm typecheck`.

---

### Task 5: Buttons, preview dialog, wiring through the chat

**Files:** create `src/components/molecules/CvButtons/{CvButtons.tsx,index.ts,CvButtons.stories.tsx}` (not `CvActions`: that name is the actions type), `src/components/molecules/PdfPreviewDialog/{PdfPreviewDialog.tsx,index.ts,PdfPreviewDialog.stories.tsx}`; modify `ProfilePreview.tsx` (+ stories: `actions` slot), `TailoredCv.tsx` (+ stories), `ChatBubble.tsx`, `ChatWindow.tsx`, `Chat.tsx`.

**Interfaces:**
- `CvButtons` molecule (client): props `{ onDownload: () => Promise<string | undefined>; onPreview: () => Promise<{ url: string } | { error: string }>; onSave?: () => void; disabledReason?: string; className?: string }`. Renders the buttons ("Preview PDF", "Download PDF", and "Save profile" when `onSave`), a polite status line (busy "Preparing PDF…", error message, or `disabledReason`), disables both PDF buttons while busy or when `disabledReason` is set, and on preview success opens `PdfPreviewDialog` (desktop) or `window.open(url, "_blank")` when `window.matchMedia("(min-width: 640px)")` doesn't match.
- `PdfPreviewDialog` molecule (client): `{ url: string; onClose: () => void }`; native `<dialog>` opened with `showModal()` on mount, `aria-labelledby` a visible title "CV preview", an `<iframe src={url} title="CV preview">` filling it, a "Close" button; `close` event → `onClose`; revokes nothing (the owner revokes the URL in `onClose`).
- `ProfilePreview` gains `actions?: ReactNode` rendered at the end of the card.
- `TailoredCv` gains `actions?: ReactNode` rendered under the header/flags.
- `BlockContextValue` gains `cvActions?: CvActions`; `ChatBubbleProps` and `ChatWindowProps` gain `cvActions?: CvActions`; `Chat.tsx` passes `cvActions` from `cv-files.ts`.
- In `ChatBubble`'s specs: `PROFILE.render` → `<ProfilePreview {...profile} actions={context.cvActions && <CvButtons onDownload={() => context.cvActions!.downloadPdf({ profile })} onPreview={() => context.cvActions!.previewPdf({ profile })} onSave={() => context.cvActions!.saveProfile(profile)} />} />`; `TAILORED.render` → `TailoredCv` with `actions={context.cvActions && <CvButtons onDownload={() => …downloadPdf({ profile: referenceProfile, tailored: block })} onPreview={…} disabledReason={blocking > 0 ? (blocking === 1 ? "Fix 1 thing before downloading" : \`Fix ${blocking} things before downloading\`) : undefined} />}` where `blocking` counts `result.flags` with level `blocking` (compute `tailorCv` once, then spread it).

- [ ] **Step 1: Stories (failing)** — `CvButtons.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { CvButtons } from "./CvButtons";

const meta = {
  title: "Molecules/CvButtons",
  component: CvButtons,
  args: { onDownload: fn(async () => undefined), onPreview: fn(async () => ({ error: "nope" })), onSave: fn() },
} satisfies Meta<typeof CvButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save profile" }));
    await expect(args.onSave).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Download PDF" }));
    await expect(args.onDownload).toHaveBeenCalledTimes(1);
  },
};

/** One request at a time: busy while the PDF is made. */
export const Busy: Story = {
  args: { onDownload: fn(() => new Promise<undefined>(() => {})) },
  play: async ({ canvas, args }) => {
    const download = canvas.getByRole("button", { name: "Download PDF" });
    await userEvent.click(download);
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing PDF…");
    await expect(download).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Preview PDF" })).toBeDisabled();
    await expect(args.onDownload).toHaveBeenCalledTimes(1);
  },
};

export const Failed: Story = {
  args: { onDownload: fn(async () => "The PDF couldn't be made. Please try again.") },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Download PDF" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("The PDF couldn't be made. Please try again.");
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  },
};

export const Disabled: Story = {
  args: { onSave: undefined, disabledReason: "Fix 2 things before downloading" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Preview PDF" })).toBeDisabled();
    await expect(canvas.getByText("Fix 2 things before downloading")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
  },
};
```

`PdfPreviewDialog.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { PdfPreviewDialog } from "./PdfPreviewDialog";

const meta = {
  title: "Molecules/PdfPreviewDialog",
  component: PdfPreviewDialog,
  args: { url: "about:blank", onClose: fn() },
} satisfies Meta<typeof PdfPreviewDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvas, args }) => {
    const dialog = canvas.getByRole("dialog", { name: "CV preview" });
    await expect(dialog).toHaveAttribute("open");
    await expect(canvas.getByTitle("CV preview")).toHaveAttribute("src", "about:blank");
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
```

(`showModal` renders the dialog in the top layer; `canvas` queries still find it because it stays in the story's DOM.)

Extend `ChatBubble.stories.tsx`: in `WithProfile` add `cvActions: { downloadPdf: fn(async () => undefined), previewPdf: fn(async () => ({ error: "x" })), saveProfile: fn() }` and assert the three buttons; in `WithTailoredCv` (which has a "Not in your profile" warning only, no blocking) add the same `cvActions` and assert "Download PDF" enabled; add a story `TailoredBlockedDownload` with a tailored reply whose bullet has no `from` and assert "Download PDF" disabled and "Fix 1 thing before downloading" shown.

- [ ] **Step 2: Run** → FAIL (components missing).

- [ ] **Step 3: Implement**

`CvButtons.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { PdfPreviewDialog } from "@/components/molecules/PdfPreviewDialog";
import { cn } from "@/lib/cn";

export type CvButtonsProps = {
  onDownload: () => Promise<string | undefined>;
  onPreview: () => Promise<{ url: string } | { error: string }>;
  /** Shown as "Save profile" when given (the profile card). */
  onSave?: () => void;
  /** Why the PDF buttons are off, e.g. blocking flags on a tailored CV. */
  disabledReason?: string;
  className?: string;
};

/**
 * A CV card's file actions: preview and download the PDF (made on the server), and save the profile.
 * One request at a time; what's happening, or what went wrong, is announced politely.
 */
export function CvButtons({ onDownload, onPreview, onSave, disabledReason, className }: CvButtonsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<string>();

  async function run(action: () => Promise<string | undefined>) {
    setBusy(true);
    setError(undefined);
    try {
      setError(await action());
    } finally {
      setBusy(false);
    }
  }

  const download = () => run(onDownload);
  const showPreview = () =>
    run(async () => {
      const result = await onPreview();
      if ("error" in result) return result.error;
      // Phones get the browser's own PDF viewer in a new tab; wider screens a dialog.
      if (window.matchMedia("(min-width: 640px)").matches) setPreview(result.url);
      else window.open(result.url, "_blank", "noopener");
      return undefined;
    });

  const off = busy || Boolean(disabledReason);
  const status = busy ? "Preparing PDF…" : (error ?? disabledReason);
  return (
    <div className={cn("mt-3 border-t border-border pt-3", className)}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={showPreview} disabled={off}>
          Preview PDF
        </Button>
        <Button onClick={download} disabled={off} aria-busy={busy}>
          Download PDF
        </Button>
        {onSave && (
          <Button variant="secondary" onClick={onSave}>
            Save profile
          </Button>
        )}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-fg-muted">
        {status}
      </p>
      {preview && (
        <PdfPreviewDialog
          url={preview}
          onClose={() => {
            URL.revokeObjectURL(preview);
            setPreview(undefined);
          }}
        />
      )}
    </div>
  );
}
```

Check `Button`'s props (variants `secondary` / default) against `atoms/Button` before writing; use its actual variant names. The component folder is `CvButtons` with `index.ts` exporting `CvButtons` and `CvButtonsProps`.

`PdfPreviewDialog.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/atoms/Button";

export type PdfPreviewDialogProps = { url: string; onClose: () => void };

/** The CV's PDF in a modal dialog. Escape or Close closes it; focus goes back to what opened it. */
export function PdfPreviewDialog({ url, onClose }: PdfPreviewDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    // Remember what had focus, and give it back on close (showModal moves focus into the dialog).
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => opener?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto h-[90vh] w-[min(56rem,92vw)] rounded-card border border-border bg-surface p-0 shadow-popover backdrop:bg-fg/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 id={titleId} className="font-semibold">
            CV preview
          </h2>
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Close
          </Button>
        </div>
        <iframe src={url} title="CV preview" className="w-full flex-1" />
      </div>
    </dialog>
  );
}
```

(`<h2>` inside a modal is a fresh heading context for screen readers; if axe's heading-order rule complains in the story, use a `<p className="font-semibold">` with the same id and ledger it.)

`ProfilePreview.tsx`: add `actions?: ReactNode` to the props type (`ProfilePreviewProps = Profile & { actions?: ReactNode; className?: string }`), destructure it, render `{actions}` as the last child of `<article>`.

`TailoredCv.tsx`: same `actions?: ReactNode` prop, rendered right after the flags `<section>` (before the CV).

`ChatBubble.tsx`: import `CvButtons`; `type CvActions` from `@/lib/cv-pdf`; add `cvActions?: CvActions` to `BlockContextValue`, `ChatBubbleProps` (doc: "The chat page's CV file actions: preview, download, save."), the signature and the `BlockContext value`. Update `PROFILE.render` and `TAILORED.render` as in Interfaces; `TAILORED.render` becomes:

```tsx
  render: (block, { referenceProfile, profileChanged, cvActions }) => {
    if (!referenceProfile) {
      return <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">This tailored CV needs your profile: ask me to read your CV first.</p>;
    }
    const result = tailorCv(referenceProfile, block, { profileChanged });
    const blocking = result.flags.filter((flag) => flag.level === "blocking").length;
    const source = { profile: referenceProfile, tailored: block };
    return (
      <TailoredCv
        job={block.job}
        {...result}
        actions={
          cvActions && (
            <CvButtons
              onDownload={() => cvActions.downloadPdf(source)}
              onPreview={() => cvActions.previewPdf(source)}
              disabledReason={blocking === 0 ? undefined : blocking === 1 ? "Fix 1 thing before downloading" : `Fix ${blocking} things before downloading`}
            />
          )
        }
      />
    );
  },
```

`ChatWindow.tsx`: `cvActions?: CvActions` in props (import the type from `@/lib/cv-pdf`), destructured and passed to every `ChatBubble` as `cvActions={cvActions}`.

`Chat.tsx`: `import { cvActions } from "./cv-files";` and pass `cvActions={cvActions}` to `ChatWindow`.

- [ ] **Step 4: Run** — `pnpm exec vitest run --project storybook src/components` → PASS (all).
- [ ] **Step 5: Checks** — `pnpm lint && pnpm lint:style && pnpm typecheck`.

---

### Task 6: e2e: downloads, disabled state, preview, save, CSP

**Files:** modify `e2e/mock-llm.mjs`, `e2e/chat.spec.ts`, `e2e/security.spec.ts`.

- [ ] **Step 1: Mock** — add a clean tailored reply (no blocking flags) behind `[tailored-clean]`: same as `TAILORED_JSON` but the second bullet has `from: [1]` and skills `["React"]` (insert `["[tailored-clean]", TAILORED_CLEAN_REPLY]` before `["[tailored]", …]` in `MARKER_REPLIES`).

- [ ] **Step 2: Failing tests** — in `chat.spec.ts`:

```ts
  test.describe("CV files", () => {
    test("downloads the profile as a PDF and saves it as JSON", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const profile = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: "Jane Citizen" }) });

      const pdfDownload = page.waitForEvent("download");
      await profile.getByRole("button", { name: "Download PDF" }).click();
      const pdf = await pdfDownload;
      expect(pdf.suggestedFilename()).toBe("Jane-Citizen-CV.pdf");
      const bytes = await readFile((await pdf.path())!);
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

      const jsonDownload = page.waitForEvent("download");
      await profile.getByRole("button", { name: "Save profile" }).click();
      const json = await jsonDownload;
      expect(json.suggestedFilename()).toBe("Jane-Citizen-profile.json");
      const saved = JSON.parse(await readFile((await json.path())!, "utf8"));
      expect(saved.basics.name).toBe("Jane Citizen");
      expect(saved.work[0].employer).toBe("Acme Lending");
    });

    test("won't download a tailored CV with things to fix, and does once it's clean", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      await sendMessage(page, "Tailor my CV [tailored]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const blocked = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: /^Tailored for/ }) });
      await expect(blocked.getByRole("button", { name: "Download PDF" })).toBeDisabled();
      await expect(blocked).toContainText("Fix 1 thing before downloading");

      await sendMessage(page, "Fix it [tailored-clean]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const clean = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: /^Tailored for/ }) }).filter({ visible: true }).last();
      const download = page.waitForEvent("download");
      await clean.getByRole("button", { name: "Download PDF" }).click();
      expect((await download).suggestedFilename()).toBe("Jane-Citizen-CV-Brightpath.pdf");
    });

    test("previews the PDF in a dialog", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Phones open a new tab instead");
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const preview = log(page).getByRole("button", { name: "Preview PDF" });
      await preview.click();
      const dialog = page.getByRole("dialog", { name: "CV preview" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(preview).toBeFocused();
    });
  });
```

(Import `readFile` from `node:fs/promises` at the top of the spec. The second test sends 3 messages: within the e2e limit of 3 per visitor.)

In `security.spec.ts` add:

```ts
test("the CSP blocks nothing while previewing a CV PDF", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The dialog preview is desktop-only");
  await page.goto("/chat");
  await page.getByRole("textbox", { name: "Message" }).fill("Read my CV into a profile [profile]");
  await page.getByRole("textbox", { name: "Message" }).press("Enter");
  await expect(page.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Preview PDF" }).click();
  await expect(page.getByRole("dialog", { name: "CV preview" })).toBeVisible();
  // Give the frame a moment to load the PDF viewer.
  await page.waitForTimeout(1000);
  expect(await violations(page)).toEqual([]);
});
```

- [ ] **Step 3: Run** → the new tests fail first only where Task 5 isn't wired (if Tasks 1–5 are done they may pass on first run: the RED for this task is the mock marker: run before adding `[tailored-clean]` and confirm the second test fails on the missing clean reply). Then all pass; run twice.
- [ ] **Step 4: Spike check** — if the CSP test or a manual look shows Chromium won't render the PDF in the frame (blank frame, a `frame-src`/`object-src` violation), switch `CvButtons` to always open a new tab, drop the dialog test, and ledger it (the spec allows this fallback).
- [ ] **Step 5: Checks** — `pnpm lint && pnpm typecheck`.

---

### Task 7: Verification, manual check, screenshots

- [ ] **Step 1:** repo root `pnpm lint && pnpm lint:style && pnpm typecheck && pnpm --filter @brighte/web test`; `cd apps/web && pnpm test:e2e e2e/chat.spec.ts e2e/security.spec.ts`.
- [ ] **Step 2:** Lighthouse on `/chat` (build, start on 3201, `pnpm lighthouse`, stop).
- [ ] **Step 3: Manual** (career persona on 3202, the sample CV and job ad): read the CV, download the profile PDF and open it (check the layout against the template section of the spec; screenshot the first page by opening the PDF in the browser); tailor, download the tailored PDF and compare; save the profile JSON, start a fresh chat, attach the JSON, check the profile comes back unchanged; preview on desktop. Screenshots `.playwright-mcp/cv-pdf-*.png`.
- [ ] **Step 4:** Report; ask about commit and PR (retarget to `main` once #64 merges).
