import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { LEADS } from "@/stories/fixtures/leads";
import { LeadDetail } from "./LeadDetail";

const meta = {
  title: "Organisms/LeadDetail",
  component: LeadDetail,
  args: { lead: LEADS[0] },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="w-full max-w-xl">
      <LeadDetail {...args} />
    </div>
  ),
} satisfies Meta<typeof LeadDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("article", { name: "Ada Lovelace" })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "ada@example.com" })).toHaveAttribute("href", "mailto:ada@example.com");
    await expect(canvas.getByRole("link", { name: "0412 345 678" })).toHaveAttribute("href", "tel:0412345678");
    await expect(canvas.getByRole("list", { name: "Services" }).querySelectorAll("li")).toHaveLength(2);
    await expect(canvas.getByText("25 Sept 2026, 9:15 am")).toHaveAttribute("datetime", "2026-09-24T23:15:00Z");
  },
};

export const ManyServices: Story = { args: { lead: LEADS[2] } };

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Loading lead")).toBeInTheDocument();
  },
};

/** The lead query returned null: the id matches no lead. */
export const NotFound: Story = {
  args: { lead: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Lead not found" })).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: { status: "error", retryHref: "?" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't load this lead");
  },
};
