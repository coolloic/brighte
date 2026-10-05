import { inflateSync } from "node:zlib";

// For tests: the text a react-pdf PDF shows. Its content streams are Flate-compressed and draw text
// as <hex> strings in the standard fonts' Windows-1252 encoding.

/** The text of each page (each page is one content stream), as pdfText does for the whole PDF. */
export function pdfPagesText(pdf: Buffer): string[] {
  const source = pdf.toString("latin1");
  const decoder = new TextDecoder("windows-1252");
  const pages: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    if (!content.includes("BT")) continue;
    const lines = [...content.matchAll(/BT([\s\S]*?)ET/g)].map((block) =>
      [...block[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((hex) => decoder.decode(Buffer.from(hex[1], "hex"))).join(""),
    );
    pages.push(lines.join("\n"));
  }
  return pages;
}

export function pdfText(pdf: Buffer): string {
  const source = pdf.toString("latin1");
  const decoder = new TextDecoder("windows-1252");
  const parts: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    // Each text object (BT … ET) on its own line, its strings joined.
    for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
      parts.push([...block[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((hex) => decoder.decode(Buffer.from(hex[1], "hex"))).join(""));
    }
  }
  return parts.join("\n");
}

export function pdfPageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
}

/**
 * The top (in points, from the page top) of each block placed at the left margin, in order: react-pdf
 * moves to a box with "1 0 0 1 <x> <y> cm". For layout checks such as "the name doesn't overlap the
 * headline".
 */
export function pdfBlockTops(pdf: Buffer, left = 51): number[] {
  const tops: number[] = [];
  for (const match of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const box of content.matchAll(new RegExp(`1 0 0 1 ${left} (-?[\\d.]+) cm`, "g"))) tops.push(Number(box[1]));
  }
  return tops;
}

/**
 * Each text object's text and baseline height on its page (points from the page bottom), in drawing
 * order. Follows the graphics state: q/Q push and pop, and "a 0 0 d e f cm" composes (react-pdf only
 * translates and flips); the text matrix's translation is the text's origin.
 */
export function pdfTextLines(pdf: Buffer): { text: string; y: number }[] {
  const decoder = new TextDecoder("windows-1252");
  const lines: { text: string; y: number }[] = [];
  for (const match of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    // Only y matters: d (vertical scale, ±1) and f (vertical translation).
    let state = { d: 1, f: 0 };
    const stack: (typeof state)[] = [];
    const tokens = /-?[\d.]+ -?[\d.]+ -?[\d.]+ (-?[\d.]+) -?[\d.]+ (-?[\d.]+) cm|\bq\b|\bQ\b|BT([\s\S]*?)ET/g;
    for (const token of content.matchAll(tokens)) {
      if (token[0] === "q") stack.push(state);
      else if (token[0] === "Q") state = stack.pop() ?? { d: 1, f: 0 };
      else if (token[1] !== undefined) state = { d: state.d * Number(token[1]), f: state.d * Number(token[2]) + state.f };
      else {
        const origin = /-?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ (-?[\d.]+) Tm/.exec(token[3]);
        const text = [...token[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((hex) => decoder.decode(Buffer.from(hex[1], "hex"))).join("");
        lines.push({ text, y: state.d * Number(origin?.[1] ?? 0) + state.f });
      }
    }
  }
  return lines;
}

