import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { FormField } from "./FormField";

const meta = {
  title: "Molecules/FormField",
  component: FormField,
  args: { id: "mobile", label: "Mobile number", type: "tel", autoComplete: "tel", inputMode: "tel", required: true },
  render: (args) => (
    <div className="w-80 max-w-full">
      <FormField {...args} />
    </div>
  ),
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "Mobile number" });
    await expect(input).toBeRequired();
    await expect(input).not.toHaveAttribute("aria-invalid");
    await userEvent.type(input, "0412 345 678");
    await expect(input).toHaveValue("0412 345 678");
  },
};

export const WithHint: Story = {
  args: { hint: "Australian mobile, e.g. 0412 345 678" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Mobile number" })).toHaveAccessibleDescription("Australian mobile, e.g. 0412 345 678");
  },
};

/** The hint stays right under the field and the error box appears below it. Screen readers read the error first. */
export const WithError: Story = {
  args: {
    hint: "Australian mobile, e.g. 0412 345 678",
    error: "Enter an Australian mobile number",
    defaultValue: "12345",
  },
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "Mobile number" });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("Enter an Australian mobile number Australian mobile, e.g. 0412 345 678");
    // On screen the hint comes first, the error below it.
    const hint = canvas.getByText("Australian mobile, e.g. 0412 345 678");
    const error = canvas.getByText("Enter an Australian mobile number");
    await expect(hint.getBoundingClientRect().bottom).toBeLessThanOrEqual(error.getBoundingClientRect().top);
  },
};

export const Optional: Story = { args: { id: "company", label: "Company", type: "text", autoComplete: "organization", inputMode: undefined, required: false } };
