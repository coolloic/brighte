import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatTurn } from "../llm";
import { recall, type RecallSources } from "./recall";

const saved = { basics: { name: "Jane Citizen", email: "jane@example.com" } };
const match = { text: "Cover letter for Engineer · Brightpath:\nI ran the accessibility audit.", document: { kind: "COVER_LETTER", title: "Engineer · Brightpath", createdAt: "2026-10-09T02:00:00Z" } };
const sources = (overrides: Partial<RecallSources> = {}): RecallSources => ({
  getMyData: vi.fn(async () => ({ profile: saved })),
  searchMyData: vi.fn(async () => [match]),
  ...overrides,
});
const asked = (content: string): ChatTurn[] => [{ role: "user", content }];

describe("recall", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds nothing, and asks nothing, without an email in the conversation", async () => {
    const s = sources();
    expect(await recall(asked("Tailor my CV"), s)).toBeUndefined();
    expect(s.getMyData).not.toHaveBeenCalled();
  });

  it("gives the saved profile and the closest saved chunks for the visitor's email", async () => {
    const s = sources();
    const text = await recall(asked("My email is Jane@example.com. What did I say about accessibility?"), s);
    expect(s.searchMyData).toHaveBeenCalledWith("jane@example.com", "My email is Jane@example.com. What did I say about accessibility?", 6);
    expect(text).toContain(`The visitor's saved profile (jane@example.com), in the profile format:\n\n${JSON.stringify(saved)}`);
    expect(text).toContain("- [Cover letter: Engineer · Brightpath, saved 9 Oct 2026] Cover letter for Engineer · Brightpath:\nI ran the accessibility audit.");
  });

  it("leaves the saved profile out when the conversation already has one", async () => {
    const turns: ChatTurn[] = [
      { role: "user", content: "Read my CV" },
      { role: "assistant", content: `\`\`\`profile\n${JSON.stringify(saved)}\n\`\`\`` },
      { role: "user", content: "Accessibility?" },
    ];
    const text = await recall(turns, sources());
    expect(text).not.toContain("saved profile");
    expect(text).toContain("From the visitor's saved data (jane@example.com)");
  });

  it("adds nothing when nothing is saved", async () => {
    expect(await recall(asked("jane@example.com"), sources({ getMyData: async () => null, searchMyData: async () => [] }))).toBeUndefined();
  });

  it("carries on without it when the API fails or is slow", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await recall(asked("jane@example.com"), sources({ getMyData: () => Promise.reject(new Error("down")) }))).toBeUndefined();
    const slow = sources({ searchMyData: () => new Promise(() => {}) });
    expect(await recall(asked("jane@example.com"), slow, 20)).toBeUndefined();
  });
});
