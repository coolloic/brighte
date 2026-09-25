import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { EmailAddress } from "./EmailAddress";

const meta = {
  title: "Atoms/EmailAddress",
  component: EmailAddress,
  args: { email: "grace.hopper@example.com.au" },
  // A narrow box, so the address has to wrap.
  render: (args) => (
    <p data-testid="box" className="w-28 break-words rounded-control border border-border p-2 text-fg">
      <EmailAddress {...args} />
    </p>
  ),
} satisfies Meta<typeof EmailAddress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Wraps after the "@" and before the dots; the text is still the plain address. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const box = canvas.getByTestId("box");
    await expect(box).toHaveTextContent("grace.hopper@example.com.au");
    // grace | .hopper@ | example | .com | .au
    await expect(box.querySelectorAll("wbr")).toHaveLength(4);
  },
};

/** A part longer than the space (like the e2e test addresses) still breaks, as a last resort. */
export const LongPart: Story = {
  args: { email: "e2e-26152f4a-fa57-44c8-8b15-c802ff9d4a21@example.com" },
  play: async ({ canvas }) => {
    const box = canvas.getByTestId("box");
    await expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
  },
};
