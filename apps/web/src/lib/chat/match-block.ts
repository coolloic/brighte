import { z } from "zod";

// A "match" block: a reply's fenced code block (```match) holding JSON, shown in the chat as a match
// report. Generic on purpose: anything checked against a list of criteria fits, e.g. a CV against a
// job ad. The same schema checks what the model wrote and, as JSON Schema, teaches the model the
// format (the career persona's prompt), so the two can't drift apart.

// The chat page parses blocks in the browser, where the CSP refuses eval. Zod would otherwise probe
// `Function("")` on its first object parse (to compile faster validators), which the browser reports
// as a CSP violation. Jitless mode skips the probe; parsing is as correct, slightly slower.
z.config({ jitless: true });

/** The code block language that marks a match block. */
export const MATCH_BLOCK = "match";

const text = (max: number) => z.string().trim().max(max);
// Models often write null for a field they leave empty: treat it as left out, not as an invalid report.
const optionalText = (max: number) =>
  text(max)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional();

export const matchBlockSchema = z.object({
  title: text(120).min(1),
  /** Overall fit, 0–100. A decimal from the model is rounded rather than refused. */
  score: z.number().min(0).max(100).transform(Math.round),
  summary: optionalText(400),
  items: z
    .array(
      z.object({
        requirement: text(200).min(1),
        status: z.enum(["met", "partial", "missing"]),
        /** What in the source (e.g. the CV) shows it. */
        evidence: optionalText(400),
        /** An honest next step, for partial or missing items. */
        suggestion: optionalText(400),
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
