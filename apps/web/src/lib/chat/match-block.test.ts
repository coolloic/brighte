import { describe, expect, it } from "vitest";
import { parseMatchBlock } from "./match-block";

const valid = {
  title: "Senior Front-end Engineer · Acme",
  score: 72,
  summary: "Strong React match; no GraphQL yet.",
  items: [
    { requirement: "5+ years React", status: "met", evidence: "8 years React at Acme and Globex" },
    { requirement: "GraphQL", status: "missing", suggestion: "Mention the Apollo course if you took it." },
  ],
};
const parse = (value: unknown) => parseMatchBlock(JSON.stringify(value));

describe("parseMatchBlock", () => {
  it("accepts a valid block", () => {
    expect(parse(valid)).toEqual(valid);
  });

  it("rounds a decimal score", () => {
    expect(parse({ ...valid, score: 72.5 })?.score).toBe(73);
  });

  it("ignores extra fields and allows evidence and suggestion to be left out", () => {
    const block = parse({ ...valid, extra: true, items: [{ requirement: "React", status: "partial", note: "x" }] });
    expect(block?.items).toEqual([{ requirement: "React", status: "partial" }]);
    expect(block).not.toHaveProperty("extra");
  });

  it("treats null optional fields as left out", () => {
    const block = parse({ ...valid, summary: null, items: [{ requirement: "React", status: "met", evidence: "8 years", suggestion: null }] });
    expect(block).toBeDefined();
    expect(block?.summary).toBeUndefined();
    expect(block?.items[0]).toEqual({ requirement: "React", status: "met", evidence: "8 years" });
  });

  it.each([
    ["a score over 100", { ...valid, score: 101 }],
    ["a negative score", { ...valid, score: -1 }],
    ["no items", { ...valid, items: [] }],
    ["31 items", { ...valid, items: Array.from({ length: 31 }, () => valid.items[0]) }],
    ["an unknown status", { ...valid, items: [{ requirement: "React", status: "Met" }] }],
    ["a missing title", { ...valid, title: undefined }],
    ["a requirement over 200 characters", { ...valid, items: [{ requirement: "a".repeat(201), status: "met" }] }],
    ["a summary over 400 characters", { ...valid, summary: "a".repeat(401) }],
  ])("rejects %s", (_, block) => {
    expect(parse(block)).toBeUndefined();
  });

  it.each(["", "{", '{"title": "Acme", "score": 7', "not json"])("returns undefined for incomplete or invalid JSON: %j", (code) => {
    expect(parseMatchBlock(code)).toBeUndefined();
  });
});
