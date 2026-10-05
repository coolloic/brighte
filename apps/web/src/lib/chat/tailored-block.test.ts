import { describe, expect, it } from "vitest";
import { parseTailoredBlock } from "./tailored-block";

const valid = {
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  headline: "Senior Front-end Engineer · React and accessibility",
  summary: "Eight years of React.",
  work: [{ role: 0, highlights: [{ text: "Led the React rebuild.", from: [0] }] }],
  projects: [{ project: 0 }],
  skills: [{ group: "Front-end", keywords: ["React"] }],
  education: [0],
  certificates: [0],
  languages: [0],
};
const parse = (value: unknown) => parseTailoredBlock(JSON.stringify(value));

describe("parseTailoredBlock", () => {
  it("accepts a valid block", () => {
    expect(parse(valid)).toEqual(valid);
  });

  it("accepts a block with only the job", () => {
    expect(parse({ job: { title: "Engineer" } })).toEqual({ job: { title: "Engineer" } });
  });

  it("drops nulls, blanks and unknown fields", () => {
    expect(parse({ job: { title: "Engineer", employer: "" }, headline: null, extra: 1 })).toEqual({ job: { title: "Engineer" } });
  });

  it.each([
    ["no job title", { job: {} }],
    ["no job", { headline: "x" }],
    ["a negative role index", { ...valid, work: [{ role: -1 }] }],
    ["a decimal role index", { ...valid, work: [{ role: 1.5 }] }],
    ["a string index", { ...valid, education: ["0"] }],
    ["a negative source index", { ...valid, work: [{ role: 0, highlights: [{ text: "x", from: [-1] }] }] }],
    ["an empty bullet", { ...valid, work: [{ role: 0, highlights: [{ text: "" , from: [0] }] }] }],
    ["31 roles", { ...valid, work: Array.from({ length: 31 }, () => ({ role: 0 })) }],
  ])("rejects %s", (_, block) => {
    expect(parse(block)).toBeUndefined();
  });

  it.each(["", "{", '{"job": {"title": "Eng', "nope"])("returns undefined for incomplete or invalid JSON: %j", (code) => {
    expect(parseTailoredBlock(code)).toBeUndefined();
  });
});
