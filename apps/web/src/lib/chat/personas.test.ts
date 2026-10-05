import { describe, expect, it } from "vitest";
import { configuredPersona, getPersona } from "./personas";

describe("personas", () => {
  it("falls back to the Brighte Eats persona for an unknown id", () => {
    expect(getPersona("nope").name).toBe("Brighte Eats assistant");
  });

  it.each([
    ["brighte", 1000, 1024],
    ["general", 1000, 1024],
    // A pasted job ad is long, and a match report is long JSON.
    ["career", 8000, 4096],
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

  it("lets the env override a persona's limits", () => {
    expect(configuredPersona({ persona: "career", maxMessageChars: 2000, maxOutputTokens: undefined })).toMatchObject({
      maxMessageChars: 2000,
      maxOutputTokens: 4096,
    });
    expect(configuredPersona({ persona: "brighte", maxMessageChars: undefined, maxOutputTokens: 512 })).toMatchObject({
      maxMessageChars: 1000,
      maxOutputTokens: 512,
    });
  });
});
