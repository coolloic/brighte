import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { readToken } from "../../../stories/foundations/color";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Atoms/Checkbox",
  component: Checkbox,
  args: { onChange: fn() },
  // The 20px box sits in a 44px-tall label, so the whole row is the touch target.
  render: (args) => (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-base text-fg">
      <Checkbox {...args} />
      Delivery
    </label>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  play: async ({ args, canvas }) => {
    const checkbox = canvas.getByRole("checkbox", { name: "Delivery" });
    await expect(canvas.getByText("Delivery").getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    await userEvent.click(canvas.getByText("Delivery"));
    await expect(checkbox).toBeChecked();
    await userEvent.keyboard(" ");
    await expect(checkbox).not.toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(2);
  },
};

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole("checkbox")).accentColor).toBe(`rgb(${readToken("control-checked")!.join(", ")})`);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByText("Delivery"));
    await expect(canvas.getByRole("checkbox")).not.toBeChecked();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
