import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { TruncatedText } from "./TruncatedText";

const LONG = "x".repeat(70);

const meta = {
  title: "Atoms/TruncatedText",
  component: TruncatedText,
  args: { children: LONG },
  parameters: { layout: "padded" },
  // A narrow column, like a table cell, with room below for the popover.
  render: (args) => (
    <div className="min-h-48 w-40 text-sm">
      <TruncatedText {...args} />
    </div>
  ),
} satisfies Meta<typeof TruncatedText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Cut off after 3 lines; hovering shows the whole text, and Escape closes it. */
export const Long: Story = {
  play: async ({ canvasElement }) => {
    const [text, popover] = canvasElement.querySelectorAll<HTMLElement>(":scope span > span");
    await expect(getComputedStyle(text).webkitLineClamp).toBe("3");
    await expect(text.scrollHeight).toBeGreaterThan(text.clientHeight);
    await expect(popover).not.toBeVisible();

    await userEvent.hover(text);
    await expect(popover).toBeVisible();
    await expect(popover).toHaveTextContent(LONG);
    // A duplicate of the text: hidden from screen readers, which already get the whole text.
    await expect(popover).toHaveAttribute("aria-hidden", "true");

    await userEvent.keyboard("{Escape}");
    await expect(popover).not.toBeVisible();
  },
};

/** Fits in 3 lines: no popover. */
export const Short: Story = {
  args: { children: "Ada Lovelace" },
  play: async ({ canvasElement }) => {
    const [text, popover] = canvasElement.querySelectorAll<HTMLElement>(":scope span > span");
    await userEvent.hover(text);
    await expect(popover).not.toBeVisible();
  },
};
