import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { FieldError } from "./FieldError";

const meta = {
  title: "Atoms/FieldError",
  component: FieldError,
  args: { id: "mobile-error", children: "Enter an Australian mobile number, e.g. 0412 345 678" },
  render: (args) => (
    <div className="w-80 max-w-full">
      <FieldError {...args} />
    </div>
  ),
} satisfies Meta<typeof FieldError>;

export default meta;
type Story = StoryObj<typeof meta>;

const rgb = (token: string) => `rgb(${readToken(token)!.join(", ")})`;

export const Default: Story = {
  play: async ({ canvas }) => {
    const message = canvas.getByText(/Enter an Australian mobile number/).closest("p")!;
    await expect(getComputedStyle(message).color).toBe(rgb("danger"));
    await expect(getComputedStyle(message).backgroundColor).toBe(rgb("danger-surface"));
    await expect(message.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  },
};

export const LongMessage: Story = {
  args: { children: "Unknown or unavailable service: teleport, warp. Choose from the options above." },
};
