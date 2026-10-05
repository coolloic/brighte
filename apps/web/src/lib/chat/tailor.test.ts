import { describe, expect, it } from "vitest";
import type { Profile } from "./profile-block";
import { tailorCv } from "./tailor";
import type { TailoredBlock } from "./tailored-block";

const profile: Profile = {
  basics: { name: "Jane Citizen", headline: "Front-end Engineer", email: "jane@example.com", summary: "8 years of React." },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      start: "2021",
      end: "present",
      highlights: ["Led the React rebuild of the loan portal (40,000 monthly users).", "Ran the WCAG 2.1 AA audit.", "Mentored 2 graduate engineers."],
      skills: ["React", "TypeScript"],
    },
    { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021", highlights: ["Built quote forms in React and Redux."] },
  ],
  projects: [{ name: "a11y-lint", highlights: ["Lint rules for accessible JSX."] }],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ keywords: ["React", "TypeScript", "Next.js", "Jest"] }],
  certificates: [{ name: "AWS Cloud Practitioner" }],
  languages: [{ language: "English" }, { language: "Mandarin" }],
};
const job = { title: "Senior Front-end Engineer", employer: "Brightpath" };
const tailor = (block: Omit<TailoredBlock, "job">, from: Profile = profile) => tailorCv(from, { job, ...block });
const messages = (result: ReturnType<typeof tailorCv>, level: "blocking" | "warning") =>
  result.flags.filter((flag) => flag.level === level).map((flag) => flag.message);

describe("tailorCv: merging", () => {
  it("replaces the headline and summary, keeping name and contact details", () => {
    const { cv } = tailor({ headline: "Senior Front-end Engineer · React", summary: "React engineer with 8 years." });
    expect(cv.basics).toEqual({ ...profile.basics, headline: "Senior Front-end Engineer · React", summary: "React engineer with 8 years." });
  });

  it("keeps the profile's headline and summary when the block has none", () => {
    expect(tailor({}).cv.basics).toEqual(profile.basics);
  });

  it("takes roles in the block's order, with every fact from the profile and the block's bullets", () => {
    const { cv } = tailor({
      work: [
        { role: 1, highlights: [{ text: "Built React quote forms.", from: [0] }] },
        { role: 0, highlights: [{ text: "Ran the WCAG 2.1 AA audit.", from: [1] }] },
      ],
    });
    expect(cv.work).toEqual([
      { ...profile.work![1], highlights: ["Built React quote forms."] },
      { ...profile.work![0], highlights: ["Ran the WCAG 2.1 AA audit."] },
    ]);
  });

  it("shows a referenced role with no bullets, and lists its bullets as left out", () => {
    const result = tailor({ work: [{ role: 1 }] });
    expect(result.cv.work).toEqual([{ ...profile.work![1], highlights: undefined }]);
    expect(result.leftOut.bullets).toEqual([{ where: "Front-end Engineer · Globex Insurance", text: "Built quote forms in React and Redux." }]);
  });

  it("allows the same role twice", () => {
    expect(tailor({ work: [{ role: 0 }, { role: 0 }] }).cv.work).toHaveLength(2);
  });

  it("picks education, certificates and languages by index, in the block's order", () => {
    const { cv } = tailor({ education: [0], certificates: [0], languages: [1, 0] });
    expect(cv.education).toEqual(profile.education);
    expect(cv.certificates).toEqual(profile.certificates);
    expect(cv.languages).toEqual([{ language: "Mandarin" }, { language: "English" }]);
  });

  it("uses the block's skills, and none when it has none", () => {
    expect(tailor({ skills: [{ group: "Front-end", keywords: ["React"] }] }).cv.skills).toEqual([{ group: "Front-end", keywords: ["React"] }]);
    expect(tailor({}).cv.skills).toBeUndefined();
  });
});

describe("tailorCv: left out and originals", () => {
  it("lists every unreferenced entry and uncited bullet", () => {
    const { leftOut } = tailor({ work: [{ role: 0, highlights: [{ text: "Led the React rebuild.", from: [0] }] }], languages: [0] });
    expect(leftOut).toEqual({
      roles: ["Front-end Engineer · Globex Insurance"],
      bullets: [
        { where: "Senior Front-end Engineer · Acme Lending", text: "Ran the WCAG 2.1 AA audit." },
        { where: "Senior Front-end Engineer · Acme Lending", text: "Mentored 2 graduate engineers." },
      ],
      projects: ["a11y-lint"],
      education: ["BSc, Computer Science · University of Sydney"],
      certificates: ["AWS Cloud Practitioner"],
      languages: ["Mandarin"],
    });
  });

  it("lists nothing when everything is used", () => {
    const { leftOut } = tailor({
      work: [
        { role: 0, highlights: [{ text: "a", from: [0, 1, 2] }] },
        { role: 1, highlights: [{ text: "b", from: [0] }] },
      ],
      projects: [{ project: 0, highlights: [{ text: "c", from: [0] }] }],
      education: [0],
      certificates: [0],
      languages: [0, 1],
    });
    expect(leftOut).toEqual({ roles: [], bullets: [], projects: [], education: [], certificates: [], languages: [] });
  });

  it("doesn't list a bullet kept word for word as reworded", () => {
    const { reworded, cv } = tailor({
      work: [{ role: 0, highlights: [{ text: " Mentored 2 graduate engineers. ", from: [2] }, { text: "Ran the accessibility audit.", from: [1] }] }],
    });
    expect(reworded.map((bullet) => bullet.text)).toEqual(["Ran the accessibility audit."]);
    expect(cv.work?.[0].highlights).toHaveLength(2);
  });

  it("gives each bullet the exact profile text it rewords", () => {
    const { reworded } = tailor({ work: [{ role: 0, highlights: [{ text: "Led the React rebuild and the accessibility audit.", from: [0, 1] }] }] });
    expect(reworded).toEqual([
      {
        where: "Senior Front-end Engineer · Acme Lending",
        text: "Led the React rebuild and the accessibility audit.",
        originals: ["Led the React rebuild of the loan portal (40,000 monthly users).", "Ran the WCAG 2.1 AA audit."],
      },
    ]);
  });
});

describe("tailorCv: blocking flags", () => {
  it.each([
    ["role", { work: [{ role: 5 }] }, "A role that isn't in your profile (number 6) was skipped."],
    ["project", { projects: [{ project: 3 }] }, "A project that isn't in your profile (number 4) was skipped."],
    ["education entry", { education: [2] }, "An education entry that isn't in your profile (number 3) was skipped."],
    ["certificate", { certificates: [1] }, "A certificate that isn't in your profile (number 2) was skipped."],
    ["language", { languages: [9] }, "A language that isn't in your profile (number 10) was skipped."],
  ])("skips and flags a %s that doesn't exist", (_, block, message) => {
    const result = tailor(block);
    expect(messages(result, "blocking")).toEqual([message]);
  });

  it("flags a bullet citing a profile bullet that doesn't exist", () => {
    const result = tailor({ work: [{ role: 1, highlights: [{ text: "Built React forms.", from: [0, 4] }] }] });
    expect(messages(result, "blocking")).toEqual(['"Built React forms." cites a bullet that isn\'t in your profile.']);
    expect(result.reworded[0].originals).toEqual(["Built quote forms in React and Redux."]);
  });

  it.each([undefined, []])("flags a bullet with no source (from: %j)", (from) => {
    const result = tailor({ work: [{ role: 0, highlights: [{ text: "Led a team of 10.", from }] }] });
    expect(messages(result, "blocking")).toEqual(['This bullet isn\'t based on anything in your profile: "Led a team of 10."']);
  });
});

describe("tailorCv: warnings", () => {
  it("flags a skill that isn't in the profile", () => {
    expect(messages(tailor({ skills: [{ keywords: ["React", "GraphQL"] }] }), "warning")).toEqual(["Not in your profile: GraphQL"]);
  });

  it.each(["next.js", "NEXTJS", "Next JS", "typescript"])("doesn't flag %j: same skill, different case or punctuation", (skill) => {
    expect(messages(tailor({ skills: [{ keywords: [skill] }] }), "warning")).toEqual([]);
  });

  it("doesn't flag a skill the profile mentions only inside a bullet", () => {
    expect(messages(tailor({ skills: [{ keywords: ["WCAG"] }] }), "warning")).toEqual([]);
  });

  it("flags a short skill that is only part of a word in the profile", () => {
    expect(messages(tailor({ skills: [{ keywords: ["Go"] }] }, { ...profile, basics: { ...profile.basics, summary: "Worked at Google." } }), "warning")).toEqual([
      "Not in your profile: Go",
    ]);
  });

  it("flags a skill that is only an ordinary word in the profile (skills are matched case-sensitively in prose)", () => {
    const keen: Profile = { ...profile, basics: { ...profile.basics, summary: "Keen to go further with React." } };
    expect(messages(tailor({ skills: [{ keywords: ["Go"] }] }, keen), "warning")).toEqual(["Not in your profile: Go"]);
  });

  it("flags a skill that only appears in an employer's name or contact details", () => {
    const swift: Profile = {
      ...profile,
      basics: { ...profile.basics, email: "rust@example.com" },
      work: [{ ...profile.work![0], employer: "Swift Logistics" }],
    };
    expect(messages(tailor({ skills: [{ keywords: ["Swift", "rust"] }] }, swift), "warning")).toEqual(["Not in your profile: Swift", "Not in your profile: rust"]);
  });

  it("flags a number that isn't in the bullet's originals", () => {
    expect(messages(tailor({ work: [{ role: 0, highlights: [{ text: "Mentored 10 graduate engineers.", from: [2] }] }] }), "warning")).toEqual([
      'New number 10 in "Mentored 10 graduate engineers." (not in the original).',
    ]);
  });

  it("doesn't flag numbers that are in the originals, with or without separators", () => {
    expect(messages(tailor({ work: [{ role: 0, highlights: [{ text: "Rebuilt a portal for 40000 users (WCAG 2.1).", from: [0, 1] }] }] }), "warning")).toEqual([]);
  });

  it("doesn't count contact details as the profile's numbers (years from its dates do count)", () => {
    const sydney: Profile = { ...profile, basics: { ...profile.basics, phone: "0412 345 678", location: { city: "Sydney 2000" } } };
    expect(messages(tailor({ summary: "Served 2000 users across 345 teams since 2017." }, sydney), "warning")).toEqual([
      "New number 2000 in the summary (not in your profile).",
      "New number 345 in the summary (not in your profile).",
    ]);
  });

  it("flags a summary or headline number that is nowhere in the profile", () => {
    expect(messages(tailor({ headline: "Engineer with 12 years", summary: "8 years of React." }), "warning")).toEqual([
      "New number 12 in the headline (not in your profile).",
    ]);
  });
});

describe("tailorCv: profile changed after tailoring", () => {
  it("adds a blocking flag, first, when the profile changed after this tailored CV", () => {
    const result = tailorCv(profile, { job, work: [{ role: 0 }] }, { profileChanged: true });
    expect(result.flags[0]).toEqual({ level: "blocking", message: "Your profile changed after this tailored CV. Ask me to tailor it again." });
    // Still rendered against the profile it was written from: the right employer.
    expect(result.cv.work?.[0].employer).toBe("Acme Lending");
  });

  it("adds no such flag otherwise", () => {
    expect(messages(tailorCv(profile, { job, work: [{ role: 0 }] }), "blocking")).toEqual([]);
  });
});

describe("tailorCv: re-check", () => {
  it("flags a role the corrected profile no longer has", () => {
    const corrected: Profile = { ...profile, work: [profile.work![0]] };
    const block = { work: [{ role: 1 }] };
    expect(messages(tailor(block), "blocking")).toEqual([]);
    expect(messages(tailor(block, corrected), "blocking")).toEqual(["A role that isn't in your profile (number 2) was skipped."]);
  });
});
