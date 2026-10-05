import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";
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

const PROFILE_JSON = JSON.stringify({
  basics: { name: "Jane Citizen", headline: "Front-end Engineer" },
  work: [{ employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021-03", end: "present" }],
});
const PROFILE_REPLY = `Here's your profile.\n\n\`\`\`profile\n${PROFILE_JSON}\n\`\`\``;

const CV_ACTIONS = () => ({ downloadPdf: fn(async () => undefined), previewPdf: fn(async () => ({ error: "x" })), saveProfile: fn() });

/** A ```profile block renders as a profile preview, with its file actions. */
export const WithProfile: Story = {
  args: { from: "assistant", author: "CV coach", children: PROFILE_REPLY, cvActions: CV_ACTIONS() },
  play: async ({ canvas }) => {
    for (const name of ["Preview PDF", "Download PDF", "Save profile"]) await expect(canvas.getByRole("button", { name })).toBeEnabled();
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.getByText("Mar 2021 – Present")).toBeInTheDocument();
  },
};

/** An earlier profile in the conversation: collapsed behind a summary (opening it is checked in e2e). */
export const ProfileCollapsed: Story = {
  args: { from: "assistant", author: "CV coach", children: PROFILE_REPLY, collapse: ["profile"] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Earlier version of your profile")).toBeInTheDocument();
    await expect(canvasElement.querySelector("details")).not.toHaveAttribute("open");
    // A chevron shows that it opens (decorative: the summary's expanded state is announced anyway).
    const summary = canvasElement.querySelector("summary")!;
    await expect(summary.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    // Inside a closed <details>: present but not shown (jest-dom's toBeVisible knows closed details).
    await expect(canvas.getByText("Jane Citizen")).not.toBeVisible();
  },
};

export const ProfileStreaming: Story = {
  args: { from: "assistant", author: "CV coach", streaming: true, children: `Here's your profile.\n\n\`\`\`profile\n${PROFILE_JSON.slice(0, 30)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing your profile…");
  },
};

export const ProfileBroken: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's your profile.\n\n\`\`\`profile\n${PROFILE_JSON.slice(0, 30)}` },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This profile couldn't be shown. It may have been cut off: ask me to try again.")).toBeInTheDocument();
  },
};

/** While a reply streams, its blocks stay mounted as text is added (selection, live regions). */
export const BlocksStayMounted: Story = {
  render: function Render() {
    const [extra, setExtra] = useState("");
    return (
      <div className="mx-auto w-full max-w-xl">
        <button type="button" onClick={() => setExtra((text) => `${text} more`)}>
          Add text
        </button>
        <ChatBubble from="assistant" author="CV coach" streaming>
          {`${PROFILE_REPLY}\n\nAnything to fix${extra}`}
        </ChatBubble>
      </div>
    );
  },
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector("article");
    await expect(card).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Add text" }));
    await expect(canvas.getByText("Anything to fix more")).toBeInTheDocument();
    await expect(canvasElement.querySelector("article")).toBe(card);
  },
};

const REFERENCE_PROFILE = {
  basics: { name: "Jane Citizen" },
  work: [{ employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021", end: "present", highlights: ["Led the React rebuild of the loan portal."] }],
};
const TAILORED_JSON = JSON.stringify({
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  work: [{ role: 0, highlights: [{ text: "Led the React and TypeScript rebuild of the loan portal.", from: [0] }] }],
  skills: [{ keywords: ["React", "GraphQL"] }],
});
const TAILORED_REPLY = `Here's your CV tailored for the role.\n\n\`\`\`tailored\n${TAILORED_JSON}\n\`\`\``;

/** A ```tailored block, checked against the reference profile. */
export const WithTailoredCv: Story = {
  args: { from: "assistant", author: "CV coach", children: TAILORED_REPLY, referenceProfile: REFERENCE_PROFILE, cvActions: CV_ACTIONS() },
  play: async ({ canvas }) => {
    // Only a warning: the PDF can be made.
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await expect(canvas.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeInTheDocument();
    await expect(canvas.getByText("Not in your profile: GraphQL")).toBeInTheDocument();
    await expect(canvas.getByText("Senior Front-end Engineer · Acme Lending")).toBeInTheDocument();
  },
};

/** A blocking flag: no PDF until it's fixed, and the reason is said. */
export const TailoredBlockedDownload: Story = {
  args: {
    from: "assistant",
    author: "CV coach",
    referenceProfile: REFERENCE_PROFILE,
    cvActions: CV_ACTIONS(),
    children: `Here's your CV.\n\n\`\`\`tailored\n${JSON.stringify({ job: { title: "Engineer" }, work: [{ role: 0, highlights: [{ text: "Led a team of 10." }] }] })}\n\`\`\``,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Preview PDF" })).toBeDisabled();
    await expect(canvas.getByText("Fix 1 thing before downloading")).toBeInTheDocument();
  },
};

/** No valid profile in the conversation: nothing to check against. */
export const TailoredWithoutProfile: Story = {
  args: { from: "assistant", author: "CV coach", children: TAILORED_REPLY },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This tailored CV needs your profile: ask me to read your CV first.")).toBeInTheDocument();
  },
};

export const TailoredCollapsed: Story = {
  args: { from: "assistant", author: "CV coach", children: TAILORED_REPLY, referenceProfile: REFERENCE_PROFILE, collapse: ["tailored"] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Earlier version of your tailored CV")).toBeInTheDocument();
    await expect(canvas.getByText("Not in your profile: GraphQL")).not.toBeVisible();
  },
};

export const TailoredStreaming: Story = {
  args: { from: "assistant", author: "CV coach", streaming: true, children: `Here's your CV.\n\n\`\`\`tailored\n${TAILORED_JSON.slice(0, 30)}`, referenceProfile: REFERENCE_PROFILE },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Preparing your tailored CV…");
  },
};

export const TailoredBroken: Story = {
  args: { from: "assistant", author: "CV coach", children: `Here's your CV.\n\n\`\`\`tailored\n${TAILORED_JSON.slice(0, 30)}`, referenceProfile: REFERENCE_PROFILE },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This tailored CV couldn't be shown. It may have been cut off: ask me to try again.")).toBeInTheDocument();
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
