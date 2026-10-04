import { describe, expect, it } from "vitest";
import { anthropicEffortLevels, textFilePart, toAnthropicMessages, toGeminiContents, toOpenAIMessages, turnsHaveFiles } from "./content";
import type { ChatTurn } from "./types";

const IMAGE = { kind: "image", name: "photo.png", mediaType: "image/png", data: "iVBORw0KGgo=" } as const;
const PDF = { kind: "pdf", name: "menu.pdf", data: "JVBERi0=" } as const;
const TEXT = { kind: "text", name: "notes.md", text: "# Notes" } as const;

const TURNS: ChatTurn[] = [
  { role: "user", content: "What's in these?", attachments: [IMAGE, PDF, TEXT] },
  { role: "assistant", content: "A photo, a menu and notes." },
  { role: "user", content: "Thanks" },
];

describe("provider content mapping", () => {
  it("Anthropic: image and document blocks before the text", () => {
    expect(toAnthropicMessages(TURNS)).toEqual([
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: IMAGE.data } },
          { type: "document", title: "menu.pdf", source: { type: "base64", media_type: "application/pdf", data: PDF.data } },
          { type: "document", title: "notes.md", source: { type: "text", media_type: "text/plain", data: "# Notes" } },
          { type: "text", text: "What's in these?" },
        ],
      },
      { role: "assistant", content: "A photo, a menu and notes." },
      { role: "user", content: "Thanks" },
    ]);
  });

  it("Anthropic: files alone, without an empty text block", () => {
    expect(toAnthropicMessages([{ role: "user", content: "", attachments: [PDF] }])[0].content).toHaveLength(1);
  });

  it("OpenAI: system first, image_url and file parts as data URLs, text files as text", () => {
    const [system, user, assistant] = toOpenAIMessages("Be brief.", TURNS);
    expect(system).toEqual({ role: "system", content: "Be brief." });
    expect(user).toEqual({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/png;base64,${IMAGE.data}` } },
        { type: "file", file: { filename: "menu.pdf", file_data: `data:application/pdf;base64,${PDF.data}` } },
        { type: "text", text: textFilePart(TEXT) },
        { type: "text", text: "What's in these?" },
      ],
    });
    expect(assistant).toEqual({ role: "assistant", content: "A photo, a menu and notes." });
  });

  it("Gemini: inline data for images and PDFs, and the assistant as 'model'", () => {
    expect(toGeminiContents(TURNS)).toEqual([
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: IMAGE.data } },
          { inlineData: { mimeType: "application/pdf", data: PDF.data } },
          { text: textFilePart(TEXT) },
          { text: "What's in these?" },
        ],
      },
      { role: "model", parts: [{ text: "A photo, a menu and notes." }] },
      { role: "user", parts: [{ text: "Thanks" }] },
    ]);
  });

  it("names a text file in a tag that its name can't break", () => {
    expect(textFilePart({ kind: "text", name: 'a"><b.txt', text: "hi" })).toBe('<file name="ab.txt">\nhi\n</file>');
  });

  it("reads a Claude model's effort levels from its capabilities", () => {
    const level = (supported: boolean) => ({ supported });
    const capabilities = (effort: object) => ({ effort }) as unknown as Parameters<typeof anthropicEffortLevels>[0];
    expect(anthropicEffortLevels(capabilities({ supported: true, low: level(true), medium: level(true), high: level(true), xhigh: null, max: level(false) }))).toEqual([
      "low",
      "medium",
      "high",
    ]);
    // Claude Haiku 4.5 and Sonnet 4.5: no effort, so none is sent.
    expect(anthropicEffortLevels(capabilities({ supported: false, low: level(false) }))).toEqual([]);
    expect(anthropicEffortLevels(null)).toEqual([]);
  });

  it("knows when a conversation has files (for prompt caching)", () => {
    expect(turnsHaveFiles(TURNS)).toBe(true);
    expect(turnsHaveFiles(TURNS.slice(1))).toBe(false);
  });
});
