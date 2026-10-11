import { tailorCv, type CoverLetterBlock, type MatchBlock, type Profile, type TailoredBlock } from "@/lib/chat";
import type { EvalCase } from "./cases";

// Scores for each output, against a case's known answers. Pure functions: no model calls here, so
// they're unit-tested (score.test.ts) like the rest of the app.

/** Lowercase, one kind of dash and apostrophe, single spaces: so formatting doesn't count as a difference. */
export const normalise = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const ratio = (part: number, whole: number) => (whole === 0 ? 1 : part / whole);

/** The case's expected answer as a profile block: the "checked" profile tailoring and letters start from. */
export function expectedProfile({ expected }: EvalCase): Profile {
  const { basics: restBasics, ...rest } = expected.rest ?? {};
  return {
    basics: { name: expected.name, ...(expected.email && { email: expected.email }), ...restBasics },
    work: expected.roles.map((role) => ({
      employer: role.employer,
      position: role.position,
      ...(role.start && { start: role.start }),
      ...(role.end && { end: role.end }),
      ...(role.bullets.length > 0 && { highlights: role.bullets }),
    })),
    ...(expected.skills.length > 0 && { skills: [{ keywords: expected.skills }] }),
    education: expected.education.map((item) => ({ institution: item.institution, ...(item.end && { end: item.end }) })),
    // The rest of the profile; its education (with qualifications) replaces the bare list above.
    ...rest,
  };
}

// Fields whose values the CV writes in another form ("Mar 2021" is "2021-03"): compared with the
// expected answer instead of looked up in the CV.
const REFORMATTED = new Set(["start", "end", "date"]);

/** Every string the model wrote into the profile, with where it was, except dates. */
function strings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => (REFORMATTED.has(key) ? [] : strings(item, path ? `${path}.${key}` : key)));
  }
  return [];
}

export type ProfileScore = {
  /** Strings that aren't in the CV: invented, or reworded (the rule is to copy). */
  invented: { path: string; text: string }[];
  /** Share of the expected roles found (by employer and title). */
  roleRecall: number;
  /** Roles that aren't in the CV. */
  extraRoles: string[];
  /** Share of the found roles' start and end dates that are exactly right. */
  dateAccuracy: number;
  wrongDates: string[];
  /** Share of the expected bullets found word for word. */
  bulletRecall: number;
  /** Share of the expected skills found in the skills section. */
  skillRecall: number;
  /** Skills-section keywords that the CV's skills section doesn't list (e.g. lifted from bullets). */
  extraSkills: string[];
  /** The email is right, or left out when the CV has none. */
  emailRight: boolean;
};

export function scoreProfile(profile: Profile, testCase: EvalCase): ProfileScore {
  const { expected } = testCase;
  const source = normalise(testCase.cv);
  // A link is copied without its scheme ("github.com/jane"); the profile adds https://.
  const invented = strings(profile).filter(({ text }) => !source.includes(normalise(text.replace(/^https?:\/\//i, "").replace(/\/$/, ""))));

  const key = (employer: string, position: string) => `${normalise(employer)}|${normalise(position)}`;
  const predicted = new Map((profile.work ?? []).map((role) => [key(role.employer, role.position), role]));
  const expectedKeys = new Set(expected.roles.map((role) => key(role.employer, role.position)));
  const found = expected.roles.flatMap((role) => {
    const match = predicted.get(key(role.employer, role.position));
    return match ? [{ expected: role, actual: match }] : [];
  });

  const wrongDates: string[] = [];
  let dateFields = 0;
  for (const { expected: role, actual } of found) {
    for (const field of ["start", "end"] as const) {
      dateFields++;
      const want = role[field]?.toLowerCase();
      const got = actual[field]?.toLowerCase();
      if (want !== got) wrongDates.push(`${role.position} · ${role.employer} ${field}: expected ${want ?? "none"}, got ${got ?? "none"}`);
    }
  }

  const expectedBullets = expected.roles.flatMap((role) => role.bullets.map((bullet) => ({ role, bullet })));
  const bulletsFound = expectedBullets.filter(({ role, bullet }) =>
    (predicted.get(key(role.employer, role.position))?.highlights ?? []).some((highlight) => normalise(highlight) === normalise(bullet)),
  ).length;

  const skills = (profile.skills ?? []).flatMap((group) => group.keywords);
  const expectedSkills = new Set(expected.skills.map(normalise));

  return {
    invented,
    roleRecall: ratio(found.length, expected.roles.length),
    extraRoles: (profile.work ?? []).filter((role) => !expectedKeys.has(key(role.employer, role.position))).map((role) => `${role.position} · ${role.employer}`),
    dateAccuracy: ratio(dateFields - wrongDates.length, dateFields),
    wrongDates,
    bulletRecall: ratio(bulletsFound, expectedBullets.length),
    skillRecall: ratio(expected.skills.filter((skill) => skills.some((s) => normalise(s) === normalise(skill))).length, expected.skills.length),
    extraSkills: skills.filter((skill) => !expectedSkills.has(normalise(skill))),
    emailRight: normalise(profile.basics.email ?? "") === normalise(expected.email ?? ""),
  };
}

export type MatchScore = {
  /** Share of the labelled requirements the report has an item for. */
  coverage: number;
  /** Share of the labelled requirements given the expected status (of those covered). */
  statusAccuracy: number;
  /** A requirement the CV doesn't meet, reported as met: the worst error, an invented strength. */
  falseCredits: string[];
  /** Every disagreement, for reading. */
  disagreements: string[];
};

export function scoreMatch(report: MatchBlock, testCase: EvalCase): MatchScore {
  const disagreements: string[] = [];
  const falseCredits: string[] = [];
  let covered = 0;
  let correct = 0;
  for (const label of testCase.match) {
    const item = report.items.find((candidate) => label.requirement.test(candidate.requirement));
    if (!item) {
      disagreements.push(`${label.requirement.source}: not in the report`);
      continue;
    }
    covered++;
    if (item.status === label.status) correct++;
    else disagreements.push(`${item.requirement}: expected ${label.status}, got ${item.status}`);
    if (label.status === "missing" && item.status === "met") falseCredits.push(item.requirement);
  }
  return { coverage: ratio(covered, testCase.match.length), statusAccuracy: ratio(correct, covered), falseCredits, disagreements };
}

export type TailoredScore = { blocking: string[]; warnings: string[] };

/** tailorCv's own checks, against the expected profile: blocking flags are what would stop a download. */
export function scoreTailored(block: TailoredBlock, testCase: EvalCase): TailoredScore {
  const { flags } = tailorCv(expectedProfile(testCase), block);
  return {
    blocking: flags.filter((flag) => flag.level === "blocking").map((flag) => flag.message),
    warnings: flags.filter((flag) => flag.level === "warning").map((flag) => flag.message),
  };
}

export type LetterShape = {
  words: number;
  paragraphs: number;
  /** 3 to 5 paragraphs and 250 to 400 words, as the persona asks. */
  inRange: boolean;
  /** Contact details written into the letter, which the page adds from the profile. */
  contactInBody: string[];
};

export function scoreLetterShape(letter: CoverLetterBlock, profile: Profile): LetterShape {
  const body = letter.paragraphs.join("\n");
  const words = body.split(/\s+/).filter(Boolean).length;
  const contacts = [profile.basics.email, profile.basics.phone].filter((value): value is string => Boolean(value));
  return {
    words,
    paragraphs: letter.paragraphs.length,
    inRange: letter.paragraphs.length >= 3 && letter.paragraphs.length <= 5 && words >= 250 && words <= 400,
    contactInBody: contacts.filter((contact) => normalise(body).includes(normalise(contact))),
  };
}

export type LetterFacts = {
  /** Sentences that write a role as current when the profile has none ("I've been… since 2022", "currently"). */
  currentClaims: string[];
};

const CURRENT = /\b(currently|at present|right now|I'm now|I am now|I now|do now)\b|\b(I've|I have) been (a|an|working|leading|building)\b|\bsince( [A-Z][a-z]+)? (19|20)\d\d\b/i;

/**
 * A mistake found with a real CV, checked by pattern: a finished role written as current. (A listed
 * skill called a gap was checked too, but a pattern can't tell it from a real gap named beside
 * listed skills ("my background is Java rather than Kotlin"), so the judge checks that.)
 */
export function scoreLetterFacts(letter: CoverLetterBlock, profile: Profile): LetterFacts {
  const sentences = letter.paragraphs.join(" ").split(/(?<=[.!?])\s+/);
  const current = (profile.work ?? []).some((role) => role.end === "present");
  return { currentClaims: current ? [] : sentences.filter((sentence) => CURRENT.test(sentence)) };
}

export type RecallScore = { hit: boolean; rank?: number };

/** Whether a chunk containing `expect` is among the matches, and its 1-based rank. */
export function scoreRecall(matches: { text: string }[], expect: string): RecallScore {
  const index = matches.findIndex((match) => normalise(match.text).includes(normalise(expect)));
  return index === -1 ? { hit: false } : { hit: true, rank: index + 1 };
}

/** Mean of numbers, or undefined for none. */
export const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined);
