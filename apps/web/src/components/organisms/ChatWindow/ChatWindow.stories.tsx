import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { ModelOption } from "@/lib/llm";
import { ChatWindow, type ChatMessage } from "./ChatWindow";

const MODELS: ModelOption[] = [
  { provider: "anthropic", providerLabel: "Anthropic", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { provider: "openai", providerLabel: "OpenAI", id: "gpt-5-mini", label: "gpt-5-mini" },
];

const CONVERSATION: ChatMessage[] = [
  { id: "1", from: "user", text: "Which services will you offer?" },
  { id: "2", from: "assistant", text: "Brighte Eats will offer delivery, pick-up and payment. Register your interest to hear first when we launch near you." },
  { id: "3", from: "user", text: "When do you launch?" },
];

const meta = {
  title: "Organisms/ChatWindow",
  component: ChatWindow,
  args: {
    assistantName: "Brighte Eats assistant",
    greeting: "Hi! I can answer questions about Brighte Eats. What would you like to know?",
    suggestions: ["What is Brighte Eats?", "How do I register my interest?"],
    onSuggestion: fn(),
    messages: [],
    models: MODELS,
    model: "anthropic:claude-haiku-4-5",
    onModelChange: fn(),
    composer: { value: "", onChange: fn(), onSend: fn(), onStop: fn(), maxChars: 1000 },
  },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="mx-auto w-full max-w-3xl">
      <ChatWindow {...args} />
    </div>
  ),
} satisfies Meta<typeof ChatWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new chat: the greeting and suggested questions. */
export const Empty: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("heading", { level: 2, name: "Brighte Eats assistant" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "What is Brighte Eats?" }));
    await expect(args.onSuggestion).toHaveBeenCalledWith("What is Brighte Eats?");
  },
};

/** Suggestions go once the visitor has said something. */
export const Conversation: Story = {
  args: { messages: [...CONVERSATION, { id: "4", from: "assistant", text: "We haven't announced a launch date yet." }] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("list", { name: "Suggested questions" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("log", { name: "Conversation" })).toHaveTextContent("You: When do you launch?");
  },
};

/** Waiting for the first words: typing dots, busy log, Stop button. The model can still be switched (for the next message). */
export const Waiting: Story = {
  args: { messages: [...CONVERSATION, { id: "4", from: "assistant", text: "" }], streaming: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("log")).toHaveAttribute("aria-busy", "true");
    await expect(canvas.getByRole("button", { name: "Model: Claude Haiku 4.5, Anthropic" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Stop the reply" })).toBeInTheDocument();
  },
};

export const Streaming: Story = {
  args: { messages: [...CONVERSATION, { id: "4", from: "assistant", text: "We haven't announced" }], streaming: true },
};

export const Failed: Story = {
  args: { messages: CONVERSATION, error: "The assistant couldn't answer just now. Please try again in a moment.", onRetry: fn() },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("couldn't answer");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

/** No Try again: waiting is the only fix. */
export const RateLimited: Story = {
  args: { messages: CONVERSATION, error: "You've sent a lot of messages. Please try again in 5 minutes." },
};

const profileReply = (name: string) => `Here's your profile.\n\n\`\`\`profile\n${JSON.stringify({ basics: { name } })}\n\`\`\``;

/** Corrections give new profiles: only the newest is open; a later message without one doesn't change that. */
export const ProfileVersions: Story = {
  args: {
    assistantName: "CV coach",
    messages: [
      { id: "1", from: "user", text: "Read my CV into a profile" },
      { id: "2", from: "assistant", text: profileReply("Jane Citizn") },
      { id: "3", from: "user", text: "My surname is spelt Citizen" },
      { id: "4", from: "assistant", text: profileReply("Jane Citizen") },
      { id: "5", from: "user", text: "Thanks" },
      { id: "6", from: "assistant", text: "You're welcome!" },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByText("Earlier version of your profile")).toHaveLength(1);
    await expect(canvasElement.querySelectorAll("details:not([open])")).toHaveLength(1);
    await expect(canvas.getByText("Jane Citizen")).toBeVisible();
    await expect(canvas.getByText("Jane Citizn")).not.toBeVisible();
  },
};

const profileWith = (roles: { employer: string; position: string }[]) =>
  `Here's your profile.\n\n\`\`\`profile\n${JSON.stringify({ basics: { name: "Jane Citizen" }, work: roles })}\n\`\`\``;
const tailoredReply = (title: string, role: number) =>
  `Here's your tailored CV.\n\n\`\`\`tailored\n${JSON.stringify({ job: { title }, work: [{ role }] })}\n\`\`\``;

/** Profiles and tailored CVs interleaved: the newest of each is open; tailored CVs use the newest valid profile. */
export const TailoredVersions: Story = {
  args: {
    assistantName: "CV coach",
    messages: [
      { id: "1", from: "user", text: "Read my CV" },
      { id: "2", from: "assistant", text: profileWith([{ employer: "Acme", position: "Engineer" }, { employer: "Globex", position: "Developer" }]) },
      { id: "3", from: "user", text: "Tailor it" },
      { id: "4", from: "assistant", text: tailoredReply("Old job", 0) },
      { id: "5", from: "user", text: "Drop Globex from my profile" },
      { id: "6", from: "assistant", text: profileWith([{ employer: "Acme", position: "Engineer" }]) },
      { id: "7", from: "user", text: "Tailor again" },
      { id: "8", from: "assistant", text: tailoredReply("New job", 1) },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Earlier version of your profile")).toHaveLength(1);
    await expect(canvas.getAllByText("Earlier version of your tailored CV")).toHaveLength(1);
    await expect(canvas.getByText("Tailored for New job")).toBeVisible();
    // Checked against the newest profile, which has no role 1 any more.
    await expect(canvas.getByText("A role that isn't in your profile (number 2) was skipped.")).toBeVisible();
  },
};

/** The profile gains a role at the top after tailoring: the tailored CV keeps the profile it was written from (the right employer) and asks to be redone. */
export const ProfileCorrectedAfterTailoring: Story = {
  args: {
    assistantName: "CV coach",
    messages: [
      { id: "1", from: "user", text: "Read my CV" },
      { id: "2", from: "assistant", text: profileWith([{ employer: "Acme", position: "Engineer" }]) },
      { id: "3", from: "user", text: "Tailor it" },
      { id: "4", from: "assistant", text: tailoredReply("Platform Engineer", 0) },
      { id: "5", from: "user", text: "You missed my Initech role, it came first" },
      { id: "6", from: "assistant", text: profileWith([{ employer: "Initech", position: "Developer" }, { employer: "Acme", position: "Engineer" }]) },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Tailored for Platform Engineer")).toBeVisible();
    await expect(canvas.getByText("Your profile changed after this tailored CV. Ask me to tailor it again.")).toBeVisible();
    const tailored = canvas.getByText("Tailored for Platform Engineer").closest("article")!;
    await expect(tailored).toHaveTextContent("Engineer · Acme");
    await expect(tailored).not.toHaveTextContent("Developer · Initech");
  },
};
