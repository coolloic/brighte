/** True when the text has a fenced code block in this language: a line that is exactly ```language. */
export function hasBlock(text: string, language: string): boolean {
  const fence = "```" + language;
  return text.split("\n").some((line) => line.trim() === fence);
}
