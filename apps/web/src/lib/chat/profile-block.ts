import { z } from "zod";
import { list, optional, parseJsonBlock, required, strings, text } from "./block-schema";

// A "profile" block: a reply's fenced code block (```profile) holding a CV as structured JSON (a
// subset of JSON Resume, plus skills per role), shown in the chat as a profile preview. It copies
// what the CV says, and is what tailoring and templates build on later. The schema checks what the
// model wrote and, as JSON Schema, teaches the model the format (the career persona's prompt).

/** The code block language that marks a profile block. */
export const PROFILE_BLOCK = "profile";

/** "2019" or "2019-03": as precise as the CV gives it. */
const date = z
  .string()
  .trim()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/);

/** A current role's end. CVs write "Present", so any case is accepted, stored as "present". */
const present = z
  .string()
  .trim()
  .regex(/^present$/i)
  .transform((): "present" => "present");

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
    summary: optional(text(2000).describe("The CV's opening summary (profile, about me), not text under a role.")),
  }),
  work: list(
    z.object({
      employer: required(160),
      position: required(160),
      location: optional(text(160)),
      start: optional(date),
      /** "present" for a current role (any case: CVs write "Present"); left out when the CV doesn't say. */
      end: optional(z.union([date, present])),
      summary: optional(text(2000).describe("Text under this role's heading that isn't a bullet point.")),
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
  return parseJsonBlock(code, profileBlockSchema);
}
