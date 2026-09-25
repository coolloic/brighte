import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { FieldError } from "../FieldError";
import { Label } from "../Label";
import { Input } from "./Input";

const meta = {
  title: "Atoms/Input",
  component: Input,
  args: { id: "email", type: "email", placeholder: "you@example.com" },
  // Inputs always come with a label; stories show it the same way.
  render: (args) => (
    <div className="w-80 max-w-full">
      <Label htmlFor="email" required={args.required}>
        Email
      </Label>
      <Input {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

const rgb = (token: string) => `rgb(${readToken(token)!.join(", ")})`;

export const Default: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Email");
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // Fluid body size (text-body): 16px on mobile up to 18px on desktop, never below 16px.
    const fontSize = parseFloat(getComputedStyle(input).fontSize);
    await expect(fontSize).toBeGreaterThanOrEqual(16);
    await expect(fontSize).toBeLessThanOrEqual(18);
    await expect(getComputedStyle(input).borderColor).toBe(rgb("border-strong"));

    // Focus turns the edge green, as on Brighte's form, 2px in total (border + outline).
    input.blur();
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(input).borderColor).toBe(rgb("focus"));
    await expect(getComputedStyle(input).outlineColor).toBe(rgb("focus"));

    await userEvent.type(input, "ada@example.com");
    await expect(input).toHaveValue("ada@example.com");
  },
};

export const Filled: Story = { args: { defaultValue: "ada@example.com" } };

export const Required: Story = { args: { required: true } };

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "not-an-email" },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Email");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(getComputedStyle(input).borderColor).toBe(rgb("danger"));
    input.blur();
    await userEvent.tab();
    await expect(getComputedStyle(input).outlineColor).toBe(rgb("danger"));
  },
};

/** How Brighte's form shows validation: the error box sits below the field and is read with it. */
export const WithError: Story = {
  args: { required: true, invalid: true, defaultValue: "ada@", "aria-describedby": "email-error" },
  render: (args) => (
    <div className="w-80 max-w-full">
      <Label htmlFor="email" required>
        Email
      </Label>
      <Input {...args} />
      <FieldError id="email-error">Enter a valid email address, e.g. ada@example.com</FieldError>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "Email" });
    await expect(input).toHaveAccessibleDescription("Enter a valid email address, e.g. ada@example.com");
  },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: "ada@example.com" } };
