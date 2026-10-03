import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";
import type { ModelOption } from "@/lib/llm/types";
import { ModelPicker, type ModelPickerProps } from "./ModelPicker";

const OPTIONS: ModelOption[] = [
  { provider: "anthropic", providerLabel: "Anthropic", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { provider: "openai", providerLabel: "OpenAI", id: "gpt-5-mini", label: "gpt-5-mini" },
  { provider: "openai", providerLabel: "OpenAI", id: "gpt-5-nano", label: "gpt-5-nano" },
  { provider: "gemini", providerLabel: "Google Gemini", id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

/** Holds the picked model, as the page does. The panel opens upwards, so leave room above. */
function Controlled(args: ModelPickerProps) {
  const [value, setValue] = useState(args.value);
  return (
    <div className="flex min-h-80 w-full max-w-md items-end justify-end">
      <ModelPicker
        {...args}
        value={value}
        onChange={(key) => {
          setValue(key);
          args.onChange(key);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Molecules/ModelPicker",
  component: ModelPicker,
  args: { id: "chat", options: OPTIONS, value: "anthropic:claude-haiku-4-5", onChange: fn() },
  parameters: { layout: "padded" },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ModelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: one small button naming the model (and, for screen readers, its provider). */
export const Closed: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Model: Claude Haiku 4.5, Anthropic" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("combobox", { name: "Provider" })).not.toBeInTheDocument();
  },
};

/** Another provider picks its first model; Escape closes the panel and returns focus to the button. */
export const Open: Story = {
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: /^Model:/ });
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-expanded", "true");

    const provider = canvas.getByRole("combobox", { name: "Provider" });
    const model = canvas.getByRole("combobox", { name: "Model" });
    await expect(model).toHaveValue("anthropic:claude-haiku-4-5");
    await userEvent.selectOptions(provider, "openai");
    await expect(args.onChange).toHaveBeenLastCalledWith("openai:gpt-5-mini");
    await expect(model).toHaveValue("openai:gpt-5-mini");
    await expect(canvas.queryByRole("option", { name: "Claude Haiku 4.5" })).not.toBeInTheDocument();
    await userEvent.selectOptions(model, "openai:gpt-5-nano");
    await expect(args.onChange).toHaveBeenLastCalledWith("openai:gpt-5-nano");
    await expect(button).toHaveAccessibleName("Model: gpt-5-nano, OpenAI");

    await userEvent.keyboard("{Escape}");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toHaveFocus();
  },
};

/** A click outside closes the panel; clicks inside (on the selects) don't. */
export const ClickOutside: Story = {
  play: async ({ canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: /^Model:/ });
    await userEvent.click(button);
    await userEvent.click(canvas.getByRole("combobox", { name: "Provider" }));
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvasElement);
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};
