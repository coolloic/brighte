import { describe, expect, it } from "vitest";
import { parseCoverLetterBlock } from "./cover-letter-block";

const letter = {
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  greeting: "Dear Hiring Manager,",
  paragraphs: ["I'd like to apply for the Senior Front-end Engineer role.", "At Acme Lending I led the React rebuild of the loan portal."],
  closing: "Kind regards,",
};

describe("parseCoverLetterBlock", () => {
  it("parses a cover letter", () => {
    expect(parseCoverLetterBlock(JSON.stringify(letter))).toEqual(letter);
  });

  it("treats blank and null optional fields as left out", () => {
    expect(parseCoverLetterBlock(JSON.stringify({ ...letter, recipient: "", job: { title: "Engineer", employer: null } }))).toEqual({
      ...letter,
      job: { title: "Engineer" },
    });
  });

  it.each([
    ["no paragraphs", { ...letter, paragraphs: [] }],
    ["no greeting", { ...letter, greeting: undefined }],
    ["no job title", { ...letter, job: { employer: "Brightpath" } }],
    ["too many paragraphs", { ...letter, paragraphs: Array.from({ length: 9 }, () => "A paragraph.") }],
  ])("rejects a letter with %s", (_, value) => {
    expect(parseCoverLetterBlock(JSON.stringify(value))).toBeUndefined();
  });

  it("rejects JSON that is still streaming in", () => {
    expect(parseCoverLetterBlock(JSON.stringify(letter).slice(0, 40))).toBeUndefined();
  });
});
