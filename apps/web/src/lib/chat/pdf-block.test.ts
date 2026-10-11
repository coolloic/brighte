import { describe, expect, it } from "vitest";
import { parsePdfBlock } from "./pdf-block";

describe("parsePdfBlock", () => {
  it.each(["cv", "tailored", "coverletter"])("parses a request for the %s", (document) => {
    expect(parsePdfBlock(JSON.stringify({ document }))).toEqual({ document });
  });

  it.each([
    ["an unknown document", '{"document":"resume"}'],
    ["no document", "{}"],
    ["half a block, while streaming", '{"document":"cv'],
  ])("rejects %s", (_, code) => {
    expect(parsePdfBlock(code)).toBeUndefined();
  });
});
