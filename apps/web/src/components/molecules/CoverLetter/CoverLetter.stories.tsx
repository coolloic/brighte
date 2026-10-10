import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { CvButtons } from "@/components/molecules/CvButtons";
import { CoverLetter } from "./CoverLetter";

const meta = {
  title: "Molecules/CoverLetter",
  component: CoverLetter,
  parameters: { layout: "padded" },
  args: {
    job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      "I'm applying for the Senior Front-end Engineer role at Brightpath. Your focus on accessible lending products matches the work I enjoy most.",
      "At Acme Lending I led the React and TypeScript rebuild of the customer loan portal, and ran its accessibility audit.",
      "I'd welcome the chance to talk about how I could help your team.",
    ],
    closing: "Kind regards,",
    sender: { name: "Jane Citizen", email: "jane@example.com", location: { city: "Sydney", region: "NSW" } },
  },
  render: (args) => (
    <div className="max-w-xl">
      <CoverLetter {...args} />
    </div>
  ),
} satisfies Meta<typeof CoverLetter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Cover letter for Senior Front-end Engineer · Brightpath" })).toBeInTheDocument();
    // The letterhead and signature come from the profile.
    await expect(canvas.getByText("Sydney, NSW · jane@example.com")).toBeInTheDocument();
    await expect(canvas.getAllByText("Jane Citizen")).toHaveLength(2);
    await expect(canvas.getByText("Dear Hiring Manager,")).toBeInTheDocument();
    await expect(canvas.getByText(/led the React and TypeScript rebuild/)).toBeInTheDocument();
  },
};

/** Addressed to a named person (from the job ad), and without an employer. */
export const ToARecipient: Story = {
  args: { job: { title: "Front-end Engineer" }, recipient: "Priya Shah, Engineering Manager", greeting: "Dear Priya," },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Cover letter for Front-end Engineer" })).toBeInTheDocument();
    await expect(canvas.getByText("Priya Shah, Engineering Manager")).toBeInTheDocument();
  },
};

/** In the chat: with the PDF buttons. */
export const WithActions: Story = {
  args: { actions: <CvButtons onDownload={fn(async () => undefined)} onPreview={fn(async () => ({ error: "Not in Storybook." }))} /> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Preview PDF" })).toBeEnabled();
  },
};

/** Long words and a narrow screen: everything wraps. */
export const LongText: Story = {
  args: {
    job: { title: "Principal Engineer, Developer Experience and Internal Tooling", employer: "A Very Long Company Name Pty Ltd" },
    paragraphs: [`${"Supercalifragilisticexpialidocious".repeat(4)} and more.`],
  },
  render: (args) => (
    <div className="w-[320px]">
      <CoverLetter {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const article = canvasElement.querySelector("article")!;
    await expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth);
  },
};
