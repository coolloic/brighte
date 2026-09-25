import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { Logo } from "./Logo";

const meta = {
  title: "Atoms/Logo",
  component: Logo,
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg")!;
    // Decorative: screen readers get the name from the surrounding link instead.
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(getComputedStyle(svg).color).toBe(`rgb(${readToken("logo")!.join(", ")})`);
  },
};

/** `className` can change the color, e.g. white on a dark background. */
export const Inverse: Story = {
  args: { className: "text-fg-inverse" },
  decorators: [(Story) => <div className="bg-fg p-4">{Story()}</div>],
};
