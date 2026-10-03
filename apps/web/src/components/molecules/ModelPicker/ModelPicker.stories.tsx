import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { ModelOption } from "@/lib/llm/types";
import { ModelPicker } from "./ModelPicker";

const OPTIONS: ModelOption[] = [
  { provider: "anthropic", providerLabel: "Anthropic", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { provider: "openai", providerLabel: "OpenAI", id: "gpt-5-mini", label: "gpt-5-mini" },
  { provider: "gemini", providerLabel: "Google Gemini", id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

const meta = {
  title: "Molecules/ModelPicker",
  component: ModelPicker,
  args: { id: "model", options: OPTIONS, value: "anthropic:claude-haiku-4-5", onChange: fn() },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="w-full max-w-xs">
      <ModelPicker {...args} />
    </div>
  ),
} satisfies Meta<typeof ModelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Models grouped by provider; picking one reports its "provider:model" key. */
export const Default: Story = {
  play: async ({ args, canvas }) => {
    const select = canvas.getByRole("combobox", { name: "Model" });
    await expect(select).toHaveValue("anthropic:claude-haiku-4-5");
    await expect(canvas.getByRole("group", { name: "OpenAI" })).toBeInTheDocument();
    await userEvent.selectOptions(select, "gemini:gemini-2.5-flash");
    await expect(args.onChange).toHaveBeenCalledWith("gemini:gemini-2.5-flash");
  },
};

/** While a reply streams. */
export const Disabled: Story = { args: { disabled: true } };
