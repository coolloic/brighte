import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import { expectedProfile, normalise, scoreLetterShape, scoreMatch, scoreProfile, scoreRecall, scoreTailored } from "./score";

const jane = CASES.find((testCase) => testCase.id === "frontend-senior")!;

describe("the eval cases", () => {
  it.each(CASES.map((testCase) => [testCase.id, testCase] as const))("%s: the expected profile scores perfectly against its own CV", (_, testCase) => {
    const score = scoreProfile(expectedProfile(testCase), testCase);
    expect(score.invented).toEqual([]);
    expect(score).toMatchObject({ roleRecall: 1, extraRoles: [], dateAccuracy: 1, bulletRecall: 1, skillRecall: 1, extraSkills: [], emailRight: true });
  });

  it("have unique ids", () => {
    expect(new Set(CASES.map((testCase) => testCase.id)).size).toBe(CASES.length);
  });
});

describe("scoreProfile", () => {
  it("counts a reworded bullet, an invented phone and a wrong date", () => {
    const profile = expectedProfile(jane);
    profile.basics.phone = "0499 999 999";
    profile.work![0].highlights = ["Led the rebuild of the loan portal for 40k users.", ...profile.work![0].highlights!.slice(1)];
    profile.work![1].end = "2021";
    const score = scoreProfile(profile, jane);
    expect(score.invented.map((item) => item.path)).toEqual(["basics.phone", "work[0].highlights[0]"]);
    expect(score.bulletRecall).toBeCloseTo(4 / 5);
    expect(score.dateAccuracy).toBe(3 / 4);
    expect(score.wrongDates).toEqual(["Front-end Engineer · Globex Insurance end: expected 2021-02, got 2021"]);
  });

  it("finds skills lifted from bullets into the skills section, and a made-up role", () => {
    const liam = CASES.find((testCase) => testCase.id === "skills-in-bullets")!;
    const profile = { ...expectedProfile(liam), skills: [{ keywords: ["SQL", "Python"] }] };
    profile.work = [...profile.work!, { employer: "Freelance", position: "Consultant" }];
    const score = scoreProfile(profile, liam);
    expect(score.extraSkills).toEqual(["SQL", "Python"]);
    expect(score.extraRoles).toEqual(["Consultant · Freelance"]);
  });

  it("ignores formatting: dashes, apostrophes, case and spaces", () => {
    expect(normalise("  Taught Years 9–12   maths’ ")).toBe("taught years 9-12 maths'");
  });
});

describe("scoreMatch", () => {
  it("scores coverage and status, and calls a missing requirement reported as met a false credit", () => {
    const score = scoreMatch(
      {
        title: "Senior Front-end Engineer · Brightpath",
        score: 80,
        items: [
          { requirement: "5+ years of React", status: "met" },
          { requirement: "GraphQL API", status: "met" },
          { requirement: "Accessibility ownership", status: "partial" },
        ],
      },
      jane,
    );
    expect(score.coverage).toBe(3 / 4);
    expect(score.statusAccuracy).toBe(1 / 3);
    expect(score.falseCredits).toEqual(["GraphQL API"]);
    expect(score.disagreements).toContain("typescript: not in the report");
  });
});

describe("scoreTailored", () => {
  it("passes a tailored CV built from the profile, and blocks an invented bullet", () => {
    const clean = scoreTailored({ job: { title: "Engineer" }, work: [{ role: 0, highlights: [{ text: "Led the React rebuild.", from: [0] }] }] }, jane);
    expect(clean.blocking).toEqual([]);
    const invented = scoreTailored({ job: { title: "Engineer" }, work: [{ role: 0, highlights: [{ text: "Led a team of 10." }] }] }, jane);
    expect(invented.blocking).toHaveLength(1);
  });
});

describe("scoreLetterShape", () => {
  it("checks length, paragraphs, and contact details in the body", () => {
    const paragraph = "word ".repeat(100).trim();
    const shape = scoreLetterShape(
      { job: { title: "Engineer" }, greeting: "Dear Hiring Manager,", paragraphs: [paragraph, paragraph, `${paragraph} Reach me at jane.citizen@example.com.`], closing: "Kind regards," },
      expectedProfile(jane),
    );
    expect(shape).toMatchObject({ paragraphs: 3, words: 304, inRange: true, contactInBody: ["jane.citizen@example.com"] });
  });
});

describe("scoreRecall", () => {
  it("gives the rank of the first chunk with the expected phrase", () => {
    expect(scoreRecall([{ text: "Mentored 2 graduate engineers" }, { text: "Ran the WCAG 2.1 AA audit" }], "WCAG 2.1 AA audit")).toEqual({ hit: true, rank: 2 });
    expect(scoreRecall([{ text: "Mentored" }], "WCAG")).toEqual({ hit: false });
  });
});
