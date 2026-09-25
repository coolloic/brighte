import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { Label } from "../Label";
import { Select } from "./Select";

const meta = {
  title: "Atoms/Select",
  component: Select,
  args: { id: "size", defaultValue: "20" },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="max-w-40">
      <Label htmlFor="size">Per page</Label>
      <Select {...args}>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </Select>
    </div>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Labelled, 44px tall, and changes with the keyboard like any native select. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const select = canvas.getByRole("combobox", { name: "Per page" });
    await expect(select).toHaveValue("20");
    await expect(select.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.selectOptions(select, "50");
    await expect(select).toHaveValue("50");
  },
};

export const Disabled: Story = { args: { disabled: true } };
