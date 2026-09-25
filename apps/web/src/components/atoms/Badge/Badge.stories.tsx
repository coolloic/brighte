import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { Badge } from "./Badge";

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "Delivery" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

const rgb = (token: string) => `rgb(${readToken(token)!.join(", ")})`;

export const Brand: Story = {
  play: async ({ canvas }) => {
    const badge = canvas.getByText("Delivery");
    await expect(getComputedStyle(badge).backgroundColor).toBe(rgb("surface-brand"));
    await expect(getComputedStyle(badge).color).toBe(rgb("fg-brand"));
  },
};

export const Neutral: Story = { args: { tone: "neutral", children: "Retired service" } };

/** On a brand-tinted background the brand badge would disappear: use the outline tone there. */
export const OutlineOnTint: Story = {
  args: { tone: "outline" },
  render: (args) => (
    <div className="rounded-card bg-surface-brand p-4">
      <Badge {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const badge = canvas.getByText("Delivery");
    await expect(getComputedStyle(badge).backgroundColor).toBe(rgb("surface"));
    await expect(getComputedStyle(badge).backgroundColor).not.toBe(getComputedStyle(badge.parentElement!).backgroundColor);
  },
};

/** How a lead's services read in the dashboard. */
export const ServiceList: Story = {
  render: () => (
    <ul aria-label="Services" className="flex flex-wrap gap-2">
      {["Delivery", "Pick-up", "Payment"].map((service) => (
        <li key={service}>
          <Badge>{service}</Badge>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: "Services" }).querySelectorAll("li")).toHaveLength(3);
  },
};
