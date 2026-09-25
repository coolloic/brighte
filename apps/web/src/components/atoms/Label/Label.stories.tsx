import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { Input } from "../Input";
import { Label } from "./Label";

const meta = {
  title: "Atoms/Label",
  component: Label,
  args: { htmlFor: "name", children: "Full name" },
  render: (args) => (
    <div className="w-80 max-w-full">
      <Label {...args} />
      <Input id="name" required={args.required} />
    </div>
  ),
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // Clicking the label focuses its input.
    await userEvent.click(canvas.getByText("Full name"));
    await expect(canvas.getByRole("textbox", { name: "Full name" })).toHaveFocus();
  },
};

export const Required: Story = {
  args: { required: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("*")).toBeVisible();
    // The asterisk is visual only: the accessible name stays clean and the input carries `required`.
    const input = canvas.getByRole("textbox", { name: "Full name" });
    await expect(input).toBeRequired();
  },
};
