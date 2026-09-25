import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { Heading } from "./Heading";

const meta = {
  title: "Atoms/Heading",
  component: Heading,
  args: { level: 1, children: "Register your interest in Brighte Eats" },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Level1: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", { level: 1 });
    await expect(getComputedStyle(heading).color).toBe(`rgb(${readToken("fg")!.join(", ")})`);
    await expect(getComputedStyle(heading).fontWeight).toBe("700");
  },
};

/** One page, levels in order: each level has its own default size. */
export const Hierarchy: Story = {
  render: () => (
    <div className="space-y-3">
      <Heading level={1}>Leads</Heading>
      <Heading level={2}>Interested in delivery</Heading>
      <Heading level={3}>Ada Lovelace</Heading>
      <Heading level={4}>Services</Heading>
    </div>
  ),
  play: async ({ canvas }) => {
    const sizes = [1, 2, 3, 4].map((level) => parseFloat(getComputedStyle(canvas.getByRole("heading", { level })).fontSize));
    // Each level is smaller than the one above.
    await expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    // Even the smallest heading stays above body text at every width (both are fluid).
    await expect(sizes[3]).toBeGreaterThan(parseFloat(getComputedStyle(document.body).fontSize));
  },
};

/** The level is for structure, the size for looks: an h2 can look like an h1. */
export const LevelAndSizeAreIndependent: Story = {
  args: { level: 2, size: "xl", children: "Section title styled large" },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", { level: 2 });
    await expect(heading.tagName).toBe("H2");
    await expect(parseFloat(getComputedStyle(heading).fontSize)).toBeGreaterThanOrEqual(30);
  },
};
