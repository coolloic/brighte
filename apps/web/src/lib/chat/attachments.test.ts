import { describe, expect, it } from "vitest";
import type { Attachment, ChatTurn } from "../llm";
import { attachmentBytes, attachmentContentMatches, fitAttachments, formatBytes, readAttachment, sniffMediaType } from "./attachments";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);
const LIMITS = { maxFiles: 3, maxFileBytes: 100, maxRequestBytes: 150 };

describe("sniffMediaType", () => {
  it.each([
    ["image/png", bytes(...PNG_HEADER, 0)],
    ["image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)],
    ["image/gif", ascii("GIF89a...")],
    ["image/webp", ascii("RIFF\0\0\0\0WEBPVP8 ")],
    ["application/pdf", ascii("%PDF-1.7")],
    [undefined, ascii("MZ\x90\0 a Windows program")],
    [undefined, ascii("<svg xmlns=...")],
  ])("%s", (expected, input) => {
    expect(sniffMediaType(input)).toBe(expected);
  });
});

describe("attachmentContentMatches", () => {
  const base64 = (data: Uint8Array) => Buffer.from(data).toString("base64");

  it("checks images and PDFs against their content", () => {
    expect(attachmentContentMatches({ kind: "image", name: "a.png", mediaType: "image/png", data: base64(bytes(...PNG_HEADER)) })).toBe(true);
    expect(attachmentContentMatches({ kind: "image", name: "a.jpg", mediaType: "image/jpeg", data: base64(bytes(...PNG_HEADER)) })).toBe(false);
    expect(attachmentContentMatches({ kind: "pdf", name: "a.pdf", data: base64(ascii("%PDF-1.7")) })).toBe(true);
    expect(attachmentContentMatches({ kind: "pdf", name: "a.pdf", data: base64(ascii("not a pdf")) })).toBe(false);
  });
});

describe("attachmentBytes and formatBytes", () => {
  it("measures decoded base64 and UTF-8 text", () => {
    expect(attachmentBytes({ kind: "pdf", name: "a.pdf", data: Buffer.alloc(10).toString("base64") })).toBe(10);
    expect(attachmentBytes({ kind: "text", name: "a.txt", text: "héllo" })).toBe(6);
  });

  it("formats sizes", () => {
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(820 * 1024)).toBe("820 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1.25 * 1024 * 1024)).toBe("1.3 MB");
  });
});

describe("readAttachment", () => {
  it("reads images and PDFs by their content, whatever the name says", async () => {
    expect(await readAttachment(new File([bytes(...PNG_HEADER)], "photo.jpg"), LIMITS)).toMatchObject({
      attachment: { kind: "image", name: "photo.jpg", mediaType: "image/png" },
    });
    expect(await readAttachment(new File([ascii("%PDF-1.7 ...")], "menu.pdf"), LIMITS)).toMatchObject({ attachment: { kind: "pdf" } });
  });

  it("reads text files as text", async () => {
    expect(await readAttachment(new File(["# Notes"], "notes.md"), LIMITS)).toEqual({ attachment: { kind: "text", name: "notes.md", text: "# Notes" } });
  });

  it("explains what can't be attached", async () => {
    expect(await readAttachment(new File([ascii("MZ program")], "setup.exe"), LIMITS)).toEqual({
      error: "setup.exe can't be attached. You can attach images (PNG, JPEG, GIF, WebP), PDF, or text (.txt, .md, .csv, .json).",
    });
    expect(await readAttachment(new File([new Uint8Array(101)], "big.pdf"), LIMITS)).toEqual({ error: "big.pdf is too big: files can be up to 1 KB." });
    expect(await readAttachment(new File([bytes(0xff, 0xfe, 0xfd)], "data.csv"), LIMITS)).toEqual({
      error: "data.csv isn't a text file we can read (it must be UTF-8 text).",
    });
  });
});

describe("fitAttachments", () => {
  const file = (name: string, size: number): Attachment => ({ kind: "pdf", name, data: Buffer.alloc(size).toString("base64") });
  const turns: ChatTurn[] = [
    { role: "user", content: "Read this", attachments: [file("old.pdf", 100)] },
    { role: "assistant", content: "Done." },
    { role: "user", content: "And this", attachments: [file("new.pdf", 100)] },
  ];

  it("keeps the newest files within the budget; older ones leave a note", () => {
    const fitted = fitAttachments(turns, 150);
    expect(fitted[2]).toEqual(turns[2]);
    expect(fitted[0]).toEqual({ role: "user", content: "Read this\n\n[Files attached earlier, no longer available: old.pdf]" });
  });

  it("changes nothing when everything fits", () => {
    expect(fitAttachments(turns, 200)).toEqual(turns);
  });
});
