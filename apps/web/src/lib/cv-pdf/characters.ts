import type { Profile } from "../chat";

// The PDF uses the standard Helvetica font, which only has the Windows-1252 (WinAnsi) characters:
// Latin-1 plus a few typographic ones. Anything else (Chinese, Cyrillic, emoji) would come out as
// garbage, so such a CV is refused with an explanation instead.

const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const supported = (char: string) => {
  const code = char.codePointAt(0)!;
  return code === 0x0a || code === 0x09 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char);
};

/** Every string in the CV. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
}

/** Characters models and CVs often use, as the closest the font has ("" drops them). */
const REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "−": "-", // minus sign
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  "\u2012": "-", // figure dash
  "●": "•",
  "▪": "•",
  "◦": "•",
  "‣": "•",
  "∙": "•",
  "≥": ">=",
  "≤": "<=",
  "\u200B": "", // zero-width space
  "\u200C": "",
  "\u200D": "",
  "\u2060": "",
  "\uFEFF": "",
  "\r": "",
};
const REPLACEABLE = new RegExp(`[${Object.keys(REPLACEMENTS).join("")}]`, "g");

/** Every string in the CV, composed (NFC: "e" + accent is "é") and with REPLACEMENTS applied. */
export function printable<T>(value: T): T {
  if (typeof value === "string") return value.normalize("NFC").replace(REPLACEABLE, (char) => REPLACEMENTS[char]) as T;
  if (Array.isArray(value)) return value.map(printable) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, printable(item)])) as T;
  return value;
}

/** The characters the PDF font can't show in a CV or letter (every string in it), each once, in order of appearance. */
export function unsupportedCharacters(value: Profile | Record<string, unknown>): string[] {
  const found = new Set<string>();
  for (const text of strings(value)) for (const char of text) if (!supported(char)) found.add(char);
  return [...found];
}
