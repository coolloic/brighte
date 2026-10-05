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
