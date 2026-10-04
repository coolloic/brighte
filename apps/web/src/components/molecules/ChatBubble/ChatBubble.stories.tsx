import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ChatBubble } from "./ChatBubble";

const meta = {
  title: "Molecules/ChatBubble",
  component: ChatBubble,
  args: { from: "user", author: "You", children: "Which services will you offer?" },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="mx-auto w-full max-w-xl">
      <ChatBubble {...args} />
    </div>
  ),
} satisfies Meta<typeof ChatBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The visitor's message: right-aligned, brand green. */
export const FromUser: Story = {
  play: async ({ canvas }) => {
    // The sender is spoken, not only shown by side and color.
    await expect(canvas.getByText("Which services will you offer?").parentElement).toHaveTextContent("You: Which services will you offer?");
  },
};

export const FromAssistant: Story = {
  args: {
    from: "assistant",
    author: "Brighte Eats assistant",
    children: "Brighte Eats will offer delivery, pick-up and payment.\n\nRegister your interest to hear first when we launch near you.",
  },
};

/** Waiting for the reply's first words. */
export const Typing: Story = {
  args: { from: "assistant", author: "Brighte Eats assistant", children: "" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("typing")).toBeInTheDocument();
  },
};

/** Long words wrap instead of scrolling the page sideways. */
export const LongWord: Story = {
  args: { children: "https://example.com/".concat("a".repeat(120)) },
};
