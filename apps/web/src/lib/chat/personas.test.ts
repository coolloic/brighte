import { describe, expect, it } from "vitest";
import { configuredPersona, getPersona } from "./personas";

describe("personas", () => {
  it("falls back to the CV coach for an unknown id", () => {
    expect(getPersona("nope").name).toBe("CV coach");
  });

  it.each([
    ["brighte", 1000, 1024],
    ["general", 1000, 1024],
    // A pasted job ad is long, and a profile is long JSON.
    ["career", 8000, 8192],
  ])("%s has its own limits", (id, maxMessageChars, maxOutputTokens) => {
    expect(getPersona(id)).toMatchObject({ maxMessageChars, maxOutputTokens });
  });

  it("teaches the career persona the match block format and the never-invent rule", () => {
    const { system } = getPersona("career");
    expect(system).toContain("```match");
    // The JSON Schema, generated from matchBlockSchema.
    expect(system).toContain('"requirement"');
    expect(system).toContain('"enum":["met","partial","missing"]');
    expect(system).toMatch(/never invent/i);
  });

  it("teaches the career persona the pdf export tool and the words that call it", () => {
    const { system } = getPersona("career");
    expect(system).toContain("```pdf");
    expect(system).toContain('{"document": "coverletter"}');
    expect(system).toMatch(/download my CV/);
    expect(system).toMatch(/don't write the document again/);
  });

  it("teaches the career persona the profile block and the extraction rules", () => {
    const { system, suggestions } = getPersona("career");
    expect(system).toContain("```profile");
    // The JSON Schema, generated from profileBlockSchema.
    expect(system).toContain('"employer"');
    expect(system).toContain('"present"');
    expect(system).toMatch(/copy what the CV says/i);
    expect(system).toMatch(/full updated profile/i);
    // Nothing the CV doesn't write, even when obvious (a country, a skills group name); the example
    // must not teach an invented group either.
    expect(system).toMatch(/only with words the CV writes/i);
    expect(system).toMatch(/even an obvious one/i);
    expect(system).toMatch(/without a heading go in one entry with no group/i);
    expect(system).not.toContain('"group": "Front-end"');
    expect(suggestions).toEqual(["Read my CV into a profile", "How well does my CV match this job?", "Tailor my CV for this job", "Write a cover letter for this job"]);
  });

  it("teaches the career persona to tailor by reference, profile first", () => {
    const { system } = getPersona("career");
    expect(system).toContain("```tailored");
    expect(system).toContain('"from"');
    expect(system).toMatch(/build the profile first/i);
    expect(system).toMatch(/never restate/i);
    expect(system).toMatch(/0-based/i);
  });

  it("asks the career persona to really tailor, and to say what it changed", () => {
    const { system } = getPersona("career");
    expect(system).toMatch(/tailor, don't copy/i);
    expect(system).toMatch(/what you emphasised and what you left out/i);
  });

  it("tells the career persona which summary is the CV's opening one", () => {
    const { system } = getPersona("career");
    // In the JSON Schema (from .describe()) and in the rules.
    expect(system).toContain("The CV's opening summary");
    expect(system).toMatch(/opening summary .* goes in basics\.summary/i);
  });

  it("teaches the career persona the cover letter block: the letter only, every claim from the profile", () => {
    const { system } = getPersona("career");
    expect(system).toContain("```coverletter");
    // The JSON Schema, generated from coverLetterBlockSchema.
    expect(system).toContain('"paragraphs"');
    expect(system).toContain('"closing"');
    expect(system).toMatch(/no name, address, email, phone or date/i);
    expect(system).toMatch(/every claim comes from the newest profile/i);
    expect(system).toMatch(/full updated cover letter/i);
  });

  it("uses saved data (my data) as the visitor's own facts, and only what it is shown", () => {
    const { system } = getPersona("career");
    expect(system).toMatch(/saved profile \(they gave their email\)[\s\S]*profile block with it unchanged/i);
    expect(system).toMatch(/saved data[\s\S]*same never-invent rules/i);
    expect(system).toMatch(/never guess at what else might be saved/i);
  });

  it("restores a saved profile file as is", () => {
    expect(getPersona("career").system).toMatch(/saved profile[\s\S]*unchanged[\s\S]*don't extract again/i);
  });

  it("lets the env override a persona's limits", () => {
    expect(configuredPersona({ persona: "career", maxMessageChars: 2000, maxOutputTokens: undefined })).toMatchObject({
      maxMessageChars: 2000,
      maxOutputTokens: 8192,
    });
    expect(configuredPersona({ persona: "brighte", maxMessageChars: undefined, maxOutputTokens: 512 })).toMatchObject({
      maxMessageChars: 1000,
      maxOutputTokens: 512,
    });
  });
});
