/** True when the text has a fenced code block in this language: a line that is exactly ```language. */
export function hasBlock(text: string, language: string): boolean {
  const fence = "```" + language;
  return text.split("\n").some((line) => line.trim() === fence);
}

/** The contents of each fenced code block in this language, in order. A block still open (streaming) runs to the end. */
export function blockContents(text: string, language: string): string[] {
  const fence = "```" + language;
  const contents: string[] = [];
  let current: string[] | undefined;
  for (const line of text.split("\n")) {
    if (current === undefined) {
      if (line.trim() === fence) current = [];
    } else if (line.trim() === "```") {
      contents.push(current.join("\n"));
      current = undefined;
    } else {
      current.push(line);
    }
  }
  if (current !== undefined) contents.push(current.join("\n"));
  return contents;
}
