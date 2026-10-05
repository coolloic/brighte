import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { TailoredCv } from "./TailoredCv";

const meta = {
  title: "Molecules/TailoredCv",
  component: TailoredCv,
  parameters: { layout: "padded" },
  args: {
    job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
    cv: {
      basics: { name: "Jane Citizen", headline: "Senior Front-end Engineer · React" },
      work: [{ employer: "Acme Lending", position: "Senior Front-end Engineer", start: "2021", end: "present", highlights: ["Led the React rebuild of the loan portal."] }],
    },
    flags: [],
    reworded: [{ where: "Senior Front-end Engineer · Acme Lending", text: "Led the React rebuild of the loan portal.", originals: ["Led the React rebuild of the customer loan portal (40,000 monthly users)."] }],
    leftOut: {
      roles: ["Front-end Engineer · Globex Insurance"],
      bullets: [{ where: "Senior Front-end Engineer · Acme Lending", text: "Mentored 2 graduate engineers." }],
      projects: [],
      education: [],
      certificates: [],
      languages: ["Mandarin"],
    },
  },
  render: (args) => (
    <div className="max-w-xl">
      <TailoredCv {...args} />
    </div>
  ),
} satisfies Meta<typeof TailoredCv>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoFlags: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeInTheDocument();
    await expect(canvas.queryByText(/things? to check/)).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeInTheDocument();
    await expect(canvas.getByText("Review changes: 1 reworded · 3 left out")).toBeInTheDocument();
    // Closed by default; its content is there for when it opens.
    await expect(canvasElement.querySelector("details")).not.toHaveAttribute("open");
    await expect(canvas.getByText("Original: Led the React rebuild of the customer loan portal (40,000 monthly users).")).not.toBeVisible();
  },
};

export const WithFlags: Story = {
  args: {
    reworded: [{ where: "Senior Front-end Engineer · Acme Lending", text: "Led a team of 10.", originals: [] }],
    flags: [
      { level: "blocking", message: 'This bullet isn\'t based on anything in your profile: "Led a team of 10."' },
      { level: "warning", message: "Not in your profile: GraphQL" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 4, name: "2 things to check" })).toBeInTheDocument();
    const blocking = canvas.getByRole("list", { name: "Fix before downloading" });
    await expect(blocking).toHaveTextContent("Led a team of 10.");
    await expect(canvas.getByRole("list", { name: "Worth a look" })).toHaveTextContent("Not in your profile: GraphQL");
    // A bullet with no source says so in the review, instead of an empty "Original:".
    await expect(canvas.getByText("No original in your profile.")).toBeInTheDocument();
  },
};

export const OneWarning: Story = {
  args: { flags: [{ level: "warning", message: "Not in your profile: GraphQL" }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 4, name: "1 thing to check" })).toBeInTheDocument();
    await expect(canvas.queryByRole("list", { name: "Fix before downloading" })).not.toBeInTheDocument();
  },
};

export const LongText: Story = {
  args: {
    job: { title: "Principal Engineer, Developer Experience and Internal Tooling", employer: "A Very Long Company Name Pty Ltd" },
    flags: [{ level: "blocking", message: `This bullet isn't based on anything in your profile: "${"x".repeat(300)}"` }],
  },
  render: (args) => (
    <div className="w-[320px]">
      <TailoredCv {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("article")!;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  },
};
