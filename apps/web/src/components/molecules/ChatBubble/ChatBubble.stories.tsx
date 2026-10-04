import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ChatBubble } from "./ChatBubble";

const meta = {
  title: "Molecules/ChatBubble",
  component: ChatBubble,
  args: { from: "user", author: "You", children: "Which services will you offer?" },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="mx-auto w-full max-w-xl">
      <ChatBubble {...args} />
    </div>
  ),
} satisfies Meta<typeof ChatBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The visitor's message: right-aligned, brand green. */
export const FromUser: Story = {
  play: async ({ canvas }) => {
    // The sender is spoken, not only shown by side and color.
    await expect(canvas.getByText("Which services will you offer?").parentElement).toHaveTextContent("You: Which services will you offer?");
  },
};

export const FromAssistant: Story = {
  args: {
    from: "assistant",
    author: "Brighte Eats assistant",
    children: "Brighte Eats will offer delivery, pick-up and payment.\n\nRegister your interest to hear first when we launch near you.",
  },
};

/** The assistant's replies are Markdown: lists, emphasis and tables render as such. */
export const AssistantMarkdown: Story = {
  args: {
    from: "assistant",
    author: "Brighte Eats assistant",
    children: "Brighte Eats will offer:\n\n- **Delivery** to your door\n- **Pick-up** from the restaurant\n- **Payment** in the app\n\n| Service | When |\n|---|---|\n| Delivery | At launch |\n| Pick-up | Later in 2027 |",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list")).toHaveTextContent("Delivery to your door");
    await expect(canvas.getByText("Delivery", { selector: "strong" })).toBeInTheDocument();
    await expect(canvas.getByRole("table")).toBeInTheDocument();
  },
};

/** The visitor's text is never Markdown: what they typed shows as typed. */
export const UserTextAsTyped: Story = {
  args: { children: "**not bold**\n- not a list" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText(/\*\*not bold\*\*/)).toBeInTheDocument();
    await expect(canvasElement.querySelector("strong, ul")).toBeNull();
  },
};

const MATCH_JSON = JSON.stringify({
  title: "Front-end Engineer · Acme",
  score: 72,
  items: [
    { requirement: "React", status: "met", evidence: "8 years" },
    { requirement: "GraphQL", status: "missing", suggestion: "Add it if you've used it." },
  ],
});

/** A ```match block in a reply renders as a match report, with the text around it. */
export const WithMatchReport: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's how you match.\n\n\`\`\`match\n${MATCH_JSON}\n\`\`\`\n\nWant me to tailor your CV?` },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Front-end Engineer · Acme" })).toBeInTheDocument();
    await expect(canvas.getByText("72%").parentElement).toHaveTextContent("72% match");
    await expect(canvas.getByText("Want me to tailor your CV?")).toBeInTheDocument();
  },
};

/** While the block's JSON is still arriving: a placeholder, announced politely. */
export const MatchReportStreaming: Story = {
  args: { from: "assistant", author: "CV coach", streaming: true, children: `Here's how you match.\n\n\`\`\`match\n${MATCH_JSON.slice(0, 40)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing match report…");
  },
};

/** Invalid JSON once the reply has ended (e.g. cut off by the length cap): a short note, no raw JSON. */
export const MatchReportBroken: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's how you match.\n\n\`\`\`match\n${MATCH_JSON.slice(0, 40)}` },
  play: async ({ canvas }) => {
    // Says what to do next: a reply cut off by the length cap ends normally, so nothing else explains it.
    await expect(canvas.getByText("This match report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer requirements.")).toBeInTheDocument();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/"title"/)).not.toBeInTheDocument();
  },
};

/** Waiting for the reply's first words. */
export const Typing: Story = {
  args: { from: "assistant", author: "Brighte Eats assistant", children: "" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("typing")).toBeInTheDocument();
  },
};

/** Long words wrap instead of scrolling the page sideways. */
export const LongWord: Story = {
  args: { children: "https://example.com/".concat("a".repeat(120)) },
};

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/1+4mRgAAAABJRU5ErkJggg==";

/** Files sent with a message, above its text. */
export const WithAttachments: Story = {
  args: {
    children: "What's on this menu?",
    attachments: [
      { name: "storefront.png", kind: "image", detail: "1.2 MB", previewSrc: PIXEL },
      { name: "menu.pdf", kind: "pdf", detail: "820 KB" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: "Attached files" })).toHaveTextContent("menu.pdf");
  },
};

/** Files alone: no text, and no typing indicator (that is only for a reply on its way). */
export const AttachmentsOnly: Story = {
  args: { children: "", attachments: [{ name: "menu.pdf", kind: "pdf", detail: "820 KB" }] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("typing")).not.toBeInTheDocument();
  },
};
