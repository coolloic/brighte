import type { Profile } from "../chat";

/** Letters and digits in any script kept; everything else collapsed to "-". */
const slug = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

type Job = { title: string; employer?: string };

/** "-Employer", else "-Title": what a file made for one job is named after. */
const forJob = (job?: Job) => (job ? `-${slug(job.employer ?? job.title)}` : "");

export function cvFilename(cv: Profile, job?: Job): string {
  return `${slug(cv.basics.name)}-CV${forJob(job)}.pdf`;
}

export function coverLetterFilename(basics: Profile["basics"], job: Job): string {
  return `${slug(basics.name)}-Cover-Letter${forJob(job)}.pdf`;
}

export function profileFilename(profile: Profile): string {
  return `${slug(profile.basics.name)}-profile.json`;
}
