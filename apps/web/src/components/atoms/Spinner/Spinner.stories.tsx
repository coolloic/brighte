import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Spinner } from "./Spinner";

const meta = {
  title: "Atoms/Spinner",
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Next to text that already says what is loading: the icon is hidden from screen readers. */
export const Decorative: Story = {
  render: (args) => (
    <p className="inline-flex items-center gap-2 text-fg">
      <Spinner {...args} />
      Loading leads…
    </p>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};

/** On its own: announced through a status region. */
export const Labelled: Story = {
  args: { label: "Loading leads" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading leads");
  },
};
