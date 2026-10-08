import { z } from "zod";
import { optional, parseJsonBlock, required, text } from "./block-schema";

// A "coverletter" block: a reply's fenced code block (```coverletter) holding a cover letter for one
// job. Only the letter itself: the sender's name and contact details come from the profile when it
// is shown or printed, so the model can't get them wrong, and the date is the day it's printed.

/** The code block language that marks a cover letter. */
export const COVER_LETTER_BLOCK = "coverletter";

export const coverLetterBlockSchema = z.object({
  job: z.object({ title: required(160), employer: optional(text(160)) }),
  /** Who it's addressed to, when the job ad names them, e.g. "Priya Shah, Engineering Manager". */
  recipient: optional(text(160)),
  /** The opening line, e.g. "Dear Priya," or "Dear Hiring Manager,". */
  greeting: required(160),
  paragraphs: z.array(required(2000)).min(1).max(8),
  /** The sign-off before the name, e.g. "Kind regards,". */
  closing: required(60),
});

export type CoverLetterBlock = z.infer<typeof coverLetterBlockSchema>;

/** The block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseCoverLetterBlock(code: string): CoverLetterBlock | undefined {
  return parseJsonBlock(code, coverLetterBlockSchema);
}
