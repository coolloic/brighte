import { describe, expect, it } from "vitest";
import { cvFilename, profileFilename } from "./filenames";

const jane = { basics: { name: "Jane Citizen" } };

describe("filenames", () => {
  it("names the profile's PDF and JSON", () => {
    expect(cvFilename(jane)).toBe("Jane-Citizen-CV.pdf");
    expect(profileFilename(jane)).toBe("Jane-Citizen-profile.json");
  });

  it("names a tailored CV after the employer, else the job title", () => {
    expect(cvFilename(jane, { title: "Senior Engineer", employer: "Brightpath Fintech" })).toBe("Jane-Citizen-CV-Brightpath-Fintech.pdf");
    expect(cvFilename(jane, { title: "Senior Engineer" })).toBe("Jane-Citizen-CV-Senior-Engineer.pdf");
  });

  it("keeps letters in any script but collapses punctuation", () => {
    expect(cvFilename({ basics: { name: "  José O'Brien-Smith!! " } })).toBe("José-O-Brien-Smith-CV.pdf");
  });
});
