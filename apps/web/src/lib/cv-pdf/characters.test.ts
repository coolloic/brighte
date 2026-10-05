import { describe, expect, it } from "vitest";
import { printable, unsupportedCharacters } from "./characters";

const cv = (summary: string) => ({ basics: { name: "Jane Citizen", summary } });

describe("unsupportedCharacters", () => {
  it("accepts Western European text and the punctuation the template uses", () => {
    expect(unsupportedCharacters(cv("Café – Zürich · “quoted” ‘single’ … € • — ñ ø ß"))).toEqual([]);
  });

  it.each([
    ["Chinese", "中文", ["中", "文"]],
    ["an emoji", "Team player 🚀", ["🚀"]],
    ["Cyrillic", "Москва", ["М", "о", "с", "к", "в", "а"]],
  ])("finds %s", (_, text, found) => {
    expect(unsupportedCharacters(cv(text))).toEqual(found);
  });

  it("checks every field, and lists each character once", () => {
    expect(unsupportedCharacters({ basics: { name: "王 王" }, work: [{ employer: "東京", position: "Dev" }] })).toEqual(["王", "東", "京"]);
  });
});

describe("printable", () => {
  it.each([
    ["an arrow", "React → Next.js", "React -> Next.js"],
    ["a minus sign", "−5% churn", "-5% churn"],
    ["non-breaking and figure hyphens", "co\u2011founder, 2019\u20122021", "co-founder, 2019-2021"],
    ["other bullets", "● one ▪ two ◦ three", "• one • two • three"],
    ["comparisons", "≥ 3 years, ≤ 5", ">= 3 years, <= 5"],
    ["zero-width characters", "Java\u200BScript\uFEFF", "JavaScript"],
    ["carriage returns", "one\r\ntwo", "one\ntwo"],
    ["decomposed accents (NFD)", "Cafe\u0301", "Café"],
  ])("maps %s to what the PDF font has", (_, text, shown) => {
    expect(printable(cv(text)).basics.summary).toBe(shown);
  });

  it("maps every string in the CV, and leaves what's fine alone", () => {
    const mapped = printable({ basics: { name: "Zoë → Smith" }, work: [{ employer: "Acme", position: "Dev", highlights: ["Cut costs − 20%"] }] });
    expect(mapped).toEqual({ basics: { name: "Zoë -> Smith" }, work: [{ employer: "Acme", position: "Dev", highlights: ["Cut costs - 20%"] }] });
  });

  it("leaves what it can't map for unsupportedCharacters to find", () => {
    expect(unsupportedCharacters(printable(cv("✓ done → 中")))).toEqual(["✓", "中"]);
  });
});

