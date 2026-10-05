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
