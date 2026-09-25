import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { Label } from "../Label";
import { PasswordInput } from "./PasswordInput";

const meta = {
  title: "Atoms/PasswordInput",
  component: PasswordInput,
  args: { id: "password", autoComplete: "current-password", defaultValue: "correct horse battery staple" },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="max-w-sm">
      <Label htmlFor={args.id}>Password</Label>
      <PasswordInput {...args} />
    </div>
  ),
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hidden by default; the eye button shows it, and pressing again hides it. Works with the keyboard. */
export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("#password")!;
    const toggle = canvas.getByRole("button", { name: "Show password" });
    await expect(input).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "password");
    // 44px touch target, inside the field.
    await expect(toggle.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    await expect(toggle.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    await userEvent.click(toggle);
    await expect(input).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(input).toHaveValue("correct horse battery staple");
    await expect(input).toHaveAttribute("spellcheck", "false");

    toggle.focus();
    await userEvent.keyboard(" ");
    await expect(input).toHaveAttribute("type", "password");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  },
};

export const Invalid: Story = { args: { invalid: true } };

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Show password" })).toBeDisabled();
  },
};
