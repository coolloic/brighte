import { describe, expect, it } from "vitest";
import { configuredPersona, getPersona } from "./personas";

describe("personas", () => {
  it("falls back to the Brighte Eats persona for an unknown id", () => {
    expect(getPersona("nope").name).toBe("Brighte Eats assistant");
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
    expect(suggestions).toEqual(["Read my CV into a profile", "How well does my CV match this job?", "Which skills should I highlight?"]);
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
