import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { ServicePicker, type ServicePickerProps } from "./ServicePicker";

const options = [
  { code: "delivery", label: "Delivery" },
  { code: "pick-up", label: "Pick-up" },
  { code: "payment", label: "Payment" },
];

// Holds the selection like a real form does.
function Controlled(args: ServicePickerProps) {
  const [value, setValue] = useState(args.value);
  return (
    <ServicePicker
      {...args}
      value={value}
      onChange={(next) => {
        setValue(next);
        args.onChange(next);
      }}
    />
  );
}

const meta = {
  title: "Molecules/ServicePicker",
  component: ServicePicker,
  args: {
    id: "services",
    legend: "Which services are you interested in?",
    options,
    value: [],
    onChange: fn(),
    required: true,
    hint: "Choose one or more.",
  },
  render: (args) => (
    <div className="w-full max-w-xl">
      <Controlled {...args} />
    </div>
  ),
} satisfies Meta<typeof ServicePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("group", { name: "Which services are you interested in?" })).toHaveAccessibleDescription("Choose one or more.");

    // The whole card is the target: clicking its text checks the box.
    await userEvent.click(canvas.getByText("Delivery"));
    await expect(args.onChange).toHaveBeenLastCalledWith(["delivery"]);
    const delivery = canvas.getByRole("checkbox", { name: "Delivery" });
    await expect(delivery).toBeChecked();
    const card = delivery.closest("label")!;
    await expect(card.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // The card fades to the brand tint (150ms): wait for that CSS transition to finish.
    await Promise.all(card.getAnimations().map((animation) => animation.finished));
    await expect(getComputedStyle(card).backgroundColor).toBe(`rgb(${readToken("surface-brand")!.join(", ")})`);

    // Keyboard: Tab to the next option, Space toggles it.
    await userEvent.tab();
    await userEvent.keyboard(" ");
    await expect(args.onChange).toHaveBeenLastCalledWith(["delivery", "pick-up"]);
  },
};

export const Preselected: Story = { args: { value: ["pick-up"] } };

export const WithError: Story = {
  args: { error: "Choose at least one service" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("group", { name: "Which services are you interested in?" })).toHaveAccessibleDescription(
      "Choose at least one service Choose one or more.",
    );
  },
};
