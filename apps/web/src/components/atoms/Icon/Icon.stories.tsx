import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Icon, ICON_NAMES } from "./Icon";

const meta = {
  title: "Atoms/Icon",
  component: Icon,
  args: { name: "chevron-right" },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Next to text that says the same thing: hidden from screen readers. */
export const Decorative: Story = {
  render: (args) => (
    <p className="inline-flex items-center gap-1 font-semibold text-fg-brand">
      Continue <Icon {...args} />
    </p>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  },
};

/** On its own: announced with its label. */
export const Labelled: Story = {
  args: { name: "info", label: "More information", className: "size-6 text-info" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "More information" })).toBeInTheDocument();
  },
};

export const AllIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 text-sm text-fg">
          <Icon name={name} className="size-6" />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("svg")).toHaveLength(ICON_NAMES.length);
  },
};
