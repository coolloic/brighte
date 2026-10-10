import { describe, expect, it } from "vitest";
import { coverLetterChunks, MAX_CHUNK_LENGTH, MAX_CHUNKS, profileChunks, tailoredChunks } from "./chunks";

const profile = {
  basics: { name: "Jane Citizen", headline: "Front-end Engineer", email: "jane@example.com", location: { city: "Sydney", region: "NSW" }, summary: "8 years of React." },
  work: [
    { employer: "Acme Lending", position: "Senior Engineer", start: "2021-03", end: "present", highlights: ["Led the React rebuild.", "Ran the accessibility audit."], skills: ["React"] },
    { employer: "Globex", position: "Engineer", start: "2017", end: "2021" },
  ],
  projects: [{ name: "Design system", description: "Shared components.", highlights: ["Used by 4 teams."] }],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ group: "Front-end", keywords: ["React", "TypeScript"] }],
  languages: [{ language: "English", fluency: "Native" }],
};

describe("profileChunks", () => {
  it("makes one chunk each for the basics, every role and project, education, and skills", () => {
    expect(profileChunks(profile)).toEqual([
      "Jane Citizen · Front-end Engineer\nSydney, NSW · jane@example.com\n8 years of React.",
      "Senior Engineer · Acme Lending · Mar 2021 – Present\n- Led the React rebuild.\n- Ran the accessibility audit.\nSkills: React",
      "Engineer · Globex · 2017 – 2021",
      "Project: Design system\nShared components.\n- Used by 4 teams.",
      "Education\nBSc, Computer Science · University of Sydney · 2016",
      "Skills, certificates and languages\nFront-end: React, TypeScript\nLanguages: English (Native)",
    ]);
  });

  it("splits a long role into chunks of at most 2,000 characters, each starting with the role", () => {
    const highlights = Array.from({ length: 20 }, (_, i) => `Bullet ${i}: ${"x".repeat(580)}`);
    const chunks = profileChunks({ basics: { name: "Jane" }, work: [{ employer: "Acme", position: "Engineer", highlights }] });
    const role = chunks.filter((chunk) => chunk.startsWith("Engineer · Acme"));
    expect(role.length).toBeGreaterThan(1);
    for (const chunk of role) expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
    expect(role.join("\n")).toContain("Bullet 19:");
  });

  it("keeps to the API's chunk count", () => {
    const work = Array.from({ length: 30 }, (_, i) => ({ employer: `E${i}`, position: "Dev", highlights: Array.from({ length: 20 }, () => "y".repeat(590)) }));
    expect(profileChunks({ basics: { name: "Jane" }, work })).toHaveLength(MAX_CHUNKS);
  });
});

describe("tailoredChunks and coverLetterChunks", () => {
  it("say which job they're for", () => {
    expect(tailoredChunks({ title: "Senior Engineer", employer: "Brightpath" }, profile)[1]).toMatch(/^Tailored CV for Senior Engineer · Brightpath: Senior Engineer · Acme Lending/);
    expect(
      coverLetterChunks({ job: { title: "Senior Engineer" }, greeting: "Dear Hiring Manager,", paragraphs: ["First.", "Second."], closing: "Kind regards," }),
    ).toEqual(["Cover letter for Senior Engineer:\nFirst.", "Cover letter for Senior Engineer:\nSecond."]);
  });
});
