import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { Text } from "./Text";

const meta = {
  title: "Atoms/Text",
  component: Text,
  args: { children: "Tell us which services you're interested in and we'll be in touch when Brighte Eats launches." },
  render: (args) => (
    <div className="max-w-prose">
      <Text {...args} />
    </div>
  ),
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

const rgb = (token: string) => `rgb(${readToken(token)!.join(", ")})`;

export const Default: Story = {
  play: async ({ canvas }) => {
    const text = canvas.getByText(/Tell us which services/);
    await expect(text.tagName).toBe("P");
    await expect(getComputedStyle(text).fontSize).toBe("16px");
    await expect(getComputedStyle(text).color).toBe(rgb("fg"));
  },
};

export const Muted: Story = {
  args: { tone: "muted", size: "sm", children: "We'll only use your details to contact you about Brighte Eats." },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByText(/only use your details/)).color).toBe(rgb("fg-muted"));
  },
};

export const Large: Story = { args: { size: "lg" } };

export const Inline: Story = {
  render: () => (
    <Text>
      Registered <Text as="span" tone="muted">2 minutes ago</Text>
    </Text>
  ),
};
