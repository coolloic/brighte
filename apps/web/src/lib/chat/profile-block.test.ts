import { describe, expect, it } from "vitest";
import { parseProfileBlock } from "./profile-block";

const full = {
  basics: {
    name: "Jane Citizen",
    headline: "Front-end Engineer",
    email: "jane@example.com",
    phone: "0412 345 678",
    location: { city: "Sydney", region: "NSW", country: "Australia" },
    links: [{ label: "GitHub", url: "https://github.com/jane" }],
    summary: "Front-end engineer with 8 years of React.",
  },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      location: "Sydney",
      start: "2021-03",
      end: "present",
      highlights: ["Led the React rebuild of the loan portal."],
      skills: ["React", "TypeScript"],
    },
    { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021" },
  ],
  education: [{ institution: "University of Sydney", qualification: "BSc", field: "Computer Science", end: "2016" }],
  skills: [{ group: "Front-end", keywords: ["React", "TypeScript"] }],
  certificates: [{ name: "AWS Cloud Practitioner", issuer: "AWS", date: "2022-05" }],
  projects: [{ name: "a11y-lint", description: "Lint rules for accessible JSX.", url: "https://github.com/jane/a11y-lint" }],
  languages: [{ language: "English", fluency: "Native" }],
};
const parse = (value: unknown) => parseProfileBlock(JSON.stringify(value));
const withRole = (role: object) => parse({ basics: { name: "Jane" }, work: [{ employer: "Acme", position: "Engineer", ...role }] });
const withLink = (url: string) => parse({ basics: { name: "Jane", links: [{ label: "Site", url }] } });

describe("parseProfileBlock", () => {
  it("accepts a full profile", () => {
    expect(parse(full)).toEqual(full);
  });

  it("accepts a profile with only a name", () => {
    expect(parse({ basics: { name: "Jane Citizen" } })).toEqual({ basics: { name: "Jane Citizen" } });
  });

  it("drops nulls and unknown fields", () => {
    const profile = parse({ basics: { name: "Jane", headline: null, nickname: "J" }, work: null, hobbies: ["chess"] });
    expect(profile).toEqual({ basics: { name: "Jane" } });
  });

  it.each(["2019", "2019-03", "2019-12"])("accepts the date %j", (start) => {
    expect(withRole({ start })?.work?.[0].start).toBe(start);
  });

  it("accepts a current role", () => {
    expect(withRole({ start: "2021", end: "present" })?.work?.[0].end).toBe("present");
  });

  it.each(["March 2019", "2019-3", "2019-13", "2019-Mar", "2019-03-01", "19"])("rejects the date %j", (start) => {
    expect(withRole({ start })).toBeUndefined();
  });

  it("treats empty strings as left out, for text, dates, links and list items", () => {
    const profile = parse({
      basics: { name: "Jane", headline: "", links: [{ label: "Site", url: "https://jane.dev" }] },
      work: [{ employer: "Acme", position: "Engineer", start: "", end: "", highlights: ["", "Shipped it"], skills: [""] }],
      projects: [{ name: "a11y-lint", url: "" }],
    });
    expect(profile).toBeDefined();
    expect(profile?.basics.headline).toBeUndefined();
    expect(profile?.work?.[0]).toEqual({ employer: "Acme", position: "Engineer", highlights: ["Shipped it"], skills: [] });
    expect(profile?.projects?.[0]).toEqual({ name: "a11y-lint" });
  });

  it.each(["Present", "PRESENT", " present "])("accepts %j as a current role", (end) => {
    expect(withRole({ start: "2021", end })?.work?.[0].end).toBe("present");
  });

  it("adds https:// to a link without a scheme", () => {
    expect(withLink("linkedin.com/in/jane")?.basics.links?.[0].url).toBe("https://linkedin.com/in/jane");
  });

  it.each(["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,hi", "mailto:jane@example.com"])("rejects the link %j", (url) => {
    expect(withLink(url)).toBeUndefined();
  });

  it.each([
    ["a missing name", { basics: {} }],
    ["no basics", { work: [] }],
    ["a role without an employer", { basics: { name: "Jane" }, work: [{ position: "Engineer" }] }],
    ["31 roles", { basics: { name: "Jane" }, work: Array.from({ length: 31 }, () => ({ employer: "Acme", position: "Engineer" })) }],
    ["a 601-character highlight", { basics: { name: "Jane" }, work: [{ employer: "Acme", position: "Engineer", highlights: ["a".repeat(601)] }] }],
    ["a skill group with no keywords", { basics: { name: "Jane" }, skills: [{ group: "Front-end", keywords: [] }] }],
  ])("rejects %s", (_, profile) => {
    expect(parse(profile)).toBeUndefined();
  });

  it.each(["", "{", '{"basics": {"name": "Ja', "not json"])("returns undefined for incomplete or invalid JSON: %j", (code) => {
    expect(parseProfileBlock(code)).toBeUndefined();
  });
});
