import { dateRange, educationDates, type CoverLetterBlock, type Profile } from "../chat";

// What "My data" embeds and searches: a saved document as chunks of text, each readable on its own
// (it says which role, job or letter it's from), so a retrieved chunk makes sense to the model.

/** The API's limits (apps/api/src/my-data/my-data.schemas.ts). */
export const MAX_CHUNK_LENGTH = 2000;
export const MAX_CHUNKS = 80;

type Job = { title: string; employer?: string };

/** "Senior Engineer · Brightpath", or the title alone. */
export const jobTitle = (job: Job) => (job.employer ? `${job.title} · ${job.employer}` : job.title);

const join = (parts: (string | undefined)[], separator = " · ") => parts.filter(Boolean).join(separator);

/**
 * A heading and its lines as chunks of at most MAX_CHUNK_LENGTH: as many lines as fit per chunk, each
 * chunk starting with the heading. A line too long on its own is cut.
 */
function pack(heading: string, lines: string[]): string[] {
  const chunks: string[] = [];
  let current = heading;
  for (const line of lines) {
    const next = `${current}\n${line}`;
    if (next.length <= MAX_CHUNK_LENGTH) current = next;
    else {
      if (current !== heading) chunks.push(current);
      current = `${heading}\n${line}`.slice(0, MAX_CHUNK_LENGTH);
    }
  }
  if (current !== heading || chunks.length === 0) chunks.push(current);
  return chunks;
}

/** A profile (or a tailored CV, merged) as chunks: basics, each role and project, education, skills and the rest. `prefix` starts each one. */
export function profileChunks(profile: Profile, prefix = ""): string[] {
  const { basics, work = [], projects = [], education = [], skills = [], certificates = [], languages = [] } = profile;
  const location = join([basics.location?.city, basics.location?.region, basics.location?.country], ", ");
  const chunks = [
    ...pack(`${prefix}${join([basics.name, basics.headline])}`, [join([location, basics.email, basics.phone]), basics.summary ?? ""].filter(Boolean)),
    ...work.flatMap((role) =>
      pack(`${prefix}${join([role.position, role.employer, role.location, dateRange(role.start, role.end)])}`, [
        ...(role.summary ? [role.summary] : []),
        ...(role.highlights ?? []).map((bullet) => `- ${bullet}`),
        ...(role.skills?.length ? [`Skills: ${role.skills.join(", ")}`] : []),
      ]),
    ),
    ...projects.flatMap((project) =>
      pack(`${prefix}Project: ${project.name}`, [
        ...(project.description ? [project.description] : []),
        ...(project.highlights ?? []).map((bullet) => `- ${bullet}`),
        ...(project.skills?.length ? [`Skills: ${project.skills.join(", ")}`] : []),
      ]),
    ),
    ...(education.length
      ? pack(
          `${prefix}Education`,
          education.map((item) => join([join([item.qualification, item.field], ", "), item.institution, educationDates(item.start, item.end), item.grade])),
        )
      : []),
    ...(skills.length || certificates.length || languages.length
      ? pack(`${prefix}Skills, certificates and languages`, [
          ...skills.map((group) => (group.group ? `${group.group}: ${group.keywords.join(", ")}` : group.keywords.join(", "))),
          ...certificates.map((item) => `Certificate: ${join([item.name, item.issuer, item.date])}`),
          ...(languages.length ? [`Languages: ${languages.map((item) => (item.fluency ? `${item.language} (${item.fluency})` : item.language)).join(", ")}`] : []),
        ])
      : []),
  ];
  return chunks.slice(0, MAX_CHUNKS);
}

/** A tailored CV (merged with its profile by tailorCv) as chunks, each saying which job it's for. */
export function tailoredChunks(job: Job, cv: Profile): string[] {
  return profileChunks(cv, `Tailored CV for ${jobTitle(job)}: `);
}

/** A cover letter as chunks: one per paragraph, each saying which job it's for. */
export function coverLetterChunks(letter: CoverLetterBlock): string[] {
  const heading = `Cover letter for ${jobTitle(letter.job)}:`;
  return letter.paragraphs.flatMap((paragraph) => pack(heading, [paragraph])).slice(0, MAX_CHUNKS);
}
