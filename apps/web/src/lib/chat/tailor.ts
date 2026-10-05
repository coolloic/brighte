import type { Profile } from "./profile-block";
import type { TailoredBlock, TailoredBullet } from "./tailored-block";

// Merges a tailored block with the profile it references, and checks it: facts (employers, titles,
// dates, degrees...) come only from the profile; everything new is flagged. Blocking flags (broken
// references, claims with no source) stop the PDF download (project 4); warnings are for the visitor.

export type TailorFlag = { level: "blocking" | "warning"; message: string };
export type RewordedBullet = { where: string; text: string; originals: string[] };
export type LeftOut = {
  roles: string[];
  bullets: { where: string; text: string }[];
  projects: string[];
  education: string[];
  certificates: string[];
  languages: string[];
};
export type TailorResult = { cv: Profile; flags: TailorFlag[]; reworded: RewordedBullet[]; leftOut: LeftOut };

type Role = NonNullable<Profile["work"]>[number];
type Project = NonNullable<Profile["projects"]>[number];
type Education = NonNullable<Profile["education"]>[number];

const roleLabel = (role: Role) => `${role.position} · ${role.employer}`;
const educationLabel = (item: Education) => {
  const title = [item.qualification, item.field].filter(Boolean).join(", ");
  return title ? `${title} · ${item.institution}` : item.institution;
};

/** Numbers in a text, without thousands separators: "40,000" and "40000" are the same; "2.1" stays. */
const numbers = (text: string) => (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
/** For comparing skills: case, spaces and punctuation don't count ("Next.js" = "nextjs"). */
const normalise = (skill: string) => skill.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The profile's own words: what a skill or a number can be backed by. Leaves out contact details,
 * links, locations and names of employers, institutions and issuers ("Swift Logistics" doesn't make
 * Swift a skill; a postcode isn't a claim). Years from the dates are added, so "since 2017" holds.
 */
function profileContent(profile: Profile): string {
  const { basics, work = [], projects = [], skills = [], education = [], certificates = [], languages = [] } = profile;
  return [
    basics.headline,
    basics.summary,
    ...work.flatMap((role) => [role.position, role.summary, ...(role.highlights ?? []), ...(role.skills ?? []), role.start, role.end]),
    ...projects.flatMap((project) => [project.name, project.description, ...(project.highlights ?? []), ...(project.skills ?? [])]),
    ...skills.flatMap((group) => [group.group, ...group.keywords]),
    ...education.flatMap((item) => [item.qualification, item.field, item.grade, item.start, item.end]),
    ...certificates.flatMap((item) => [item.name, item.date]),
    ...languages.flatMap((item) => [item.language, item.fluency]),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * `profile` is the one the block was written from (its indexes point into it). `profileChanged`: a
 * newer profile exists. The indexes can't be trusted against it (entries may have moved), so the CV
 * stays on the old profile and gets a blocking flag asking for a new tailoring.
 */
export function tailorCv(profile: Profile, block: TailoredBlock, { profileChanged = false }: { profileChanged?: boolean } = {}): TailorResult {
  const flags: TailorFlag[] = [];
  if (profileChanged) flags.push({ level: "blocking", message: "Your profile changed after this tailored CV. Ask me to tailor it again." });
  const reworded: RewordedBullet[] = [];
  const leftOut: LeftOut = { roles: [], bullets: [], projects: [], education: [], certificates: [], languages: [] };
  const content = profileContent(profile);
  const profileNumbers = new Set(numbers(content));

  const missing = (kind: string, index: number) =>
    flags.push({ level: "blocking", message: `${/^[aeiou]/.test(kind) ? "An" : "A"} ${kind} that isn't in your profile (number ${index + 1}) was skipped.` });

  /** The block's bullets for one profile entry: their texts, with originals and flags recorded. */
  function tailorBullets(where: string, sources: string[] = [], bullets: TailoredBullet[] = [], cited: Set<number>) {
    return bullets.map((bullet) => {
      const from = bullet.from ?? [];
      if (from.length === 0) {
        flags.push({ level: "blocking", message: `This bullet isn't based on anything in your profile: "${bullet.text}"` });
      }
      const originals: string[] = [];
      let broken = false;
      for (const index of from) {
        const source = sources[index];
        if (source === undefined) broken = true;
        else {
          originals.push(source);
          cited.add(index);
        }
      }
      if (broken) flags.push({ level: "blocking", message: `"${bullet.text}" cites a bullet that isn't in your profile.` });
      if (originals.length > 0) {
        const known = new Set(originals.flatMap(numbers));
        for (const n of new Set(numbers(bullet.text))) {
          if (!known.has(n)) flags.push({ level: "warning", message: `New number ${n} in "${bullet.text}" (not in the original).` });
        }
      }
      // Kept word for word: not a change to review.
      const kept = originals.length === 1 && bullet.text.trim() === originals[0].trim();
      if (!kept) reworded.push({ where, text: bullet.text, originals });
      return bullet.text;
    });
  }

  /** Entries picked by index: in the block's order; missing ones flagged; unpicked ones left out. */
  function pick<T>(entries: T[] = [], indexes: number[] = [], kind: string, label: (entry: T) => string, out: string[]): T[] {
    const picked: T[] = [];
    for (const index of indexes) {
      const entry = entries[index];
      if (entry === undefined) missing(kind, index);
      else picked.push(entry);
    }
    entries.forEach((entry, index) => {
      if (!indexes.includes(index)) out.push(label(entry));
    });
    return picked;
  }

  const roles = profile.work ?? [];
  const work: Role[] = [];
  const usedRoles = new Set<number>();
  const citedByRole = new Map<number, Set<number>>();
  for (const item of block.work ?? []) {
    const role = roles[item.role];
    if (!role) {
      missing("role", item.role);
      continue;
    }
    usedRoles.add(item.role);
    const cited = citedByRole.get(item.role) ?? new Set<number>();
    citedByRole.set(item.role, cited);
    const texts = tailorBullets(roleLabel(role), role.highlights, item.highlights, cited);
    work.push({ ...role, highlights: texts.length ? texts : undefined });
  }
  roles.forEach((role, index) => {
    if (!usedRoles.has(index)) leftOut.roles.push(roleLabel(role));
    else (role.highlights ?? []).forEach((bullet, i) => !citedByRole.get(index)!.has(i) && leftOut.bullets.push({ where: roleLabel(role), text: bullet }));
  });

  const allProjects = profile.projects ?? [];
  const projects: Project[] = [];
  const usedProjects = new Set<number>();
  const citedByProject = new Map<number, Set<number>>();
  for (const item of block.projects ?? []) {
    const project = allProjects[item.project];
    if (!project) {
      missing("project", item.project);
      continue;
    }
    usedProjects.add(item.project);
    const cited = citedByProject.get(item.project) ?? new Set<number>();
    citedByProject.set(item.project, cited);
    const texts = tailorBullets(project.name, project.highlights, item.highlights, cited);
    projects.push({ ...project, highlights: texts.length ? texts : undefined });
  }
  allProjects.forEach((project, index) => {
    if (!usedProjects.has(index)) leftOut.projects.push(project.name);
    else (project.highlights ?? []).forEach((bullet, i) => !citedByProject.get(index)!.has(i) && leftOut.bullets.push({ where: project.name, text: bullet }));
  });

  const education = pick(profile.education, block.education, "education entry", educationLabel, leftOut.education);
  const certificates = pick(profile.certificates, block.certificates, "certificate", (c) => c.name, leftOut.certificates);
  const languages = pick(profile.languages, block.languages, "language", (l) => l.language, leftOut.languages);

  const knownSkills = new Set([...(profile.skills ?? []).flatMap((g) => g.keywords), ...roles.flatMap((r) => r.skills ?? []), ...allProjects.flatMap((p) => p.skills ?? [])].map(normalise));
  for (const keyword of (block.skills ?? []).flatMap((group) => group.keywords)) {
    // In prose, a skill is a proper noun: matched as written ("WCAG" yes; "Go" not in "go further").
    const asWord = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(keyword)}($|[^\\p{L}\\p{N}])`, "u");
    if (!knownSkills.has(normalise(keyword)) && !asWord.test(content)) flags.push({ level: "warning", message: `Not in your profile: ${keyword}` });
  }

  for (const field of ["headline", "summary"] as const) {
    for (const n of new Set(numbers(block[field] ?? ""))) {
      if (!profileNumbers.has(n)) flags.push({ level: "warning", message: `New number ${n} in the ${field} (not in your profile).` });
    }
  }

  const cv: Profile = {
    basics: { ...profile.basics, headline: block.headline ?? profile.basics.headline, summary: block.summary ?? profile.basics.summary },
    work: block.work ? work : undefined,
    projects: block.projects ? projects : undefined,
    skills: block.skills,
    education: block.education ? education : undefined,
    certificates: block.certificates ? certificates : undefined,
    languages: block.languages ? languages : undefined,
  };
  // Blocking first, as the view lists them.
  flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "blocking" ? -1 : 1));
  return { cv, flags, reworded, leftOut };
}
