import { describe, expect, it } from "vitest";
import type { ChatTurn } from "../llm";
import { conversationEmail, hasProfile } from "./email";

const profileReply = (email?: string): ChatTurn => ({
  role: "assistant",
  content: `Here's your profile.\n\n\`\`\`profile\n${JSON.stringify({ basics: { name: "Jane", ...(email && { email }) } })}\n\`\`\``,
});

describe("conversationEmail", () => {
  it("prefers the newest profile's email, lowercased", () => {
    expect(conversationEmail([{ role: "user", content: "I'm other@example.com" }, profileReply("Jane@Example.com")])).toBe("jane@example.com");
  });

  it("falls back to the newest email the visitor wrote", () => {
    expect(conversationEmail([{ role: "user", content: "old@example.com" }, profileReply(), { role: "user", content: "My email is Jane.Citizen+cv@mail.example.com." }])).toBe(
      "jane.citizen+cv@mail.example.com",
    );
  });

  it("ignores emails the assistant wrote outside a profile", () => {
    expect(conversationEmail([{ role: "user", content: "Hi" }, { role: "assistant", content: "Write to help@example.com" }])).toBeUndefined();
  });
});

describe("hasProfile", () => {
  it("is true only for a valid profile block", () => {
    expect(hasProfile([profileReply()])).toBe(true);
    expect(hasProfile([{ role: "assistant", content: "```profile\n{\n```" }])).toBe(false);
  });
});
