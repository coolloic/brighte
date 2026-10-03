import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent } from "storybook/test";
import { ChatComposer, type ChatComposerProps } from "./ChatComposer";

/** Holds the typed text, as the page does. */
function Controlled(args: ChatComposerProps) {
  const [value, setValue] = useState(args.value);
  return (
    <div className="mx-auto w-full max-w-xl">
      <ChatComposer
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Molecules/ChatComposer",
  component: ChatComposer,
  args: { id: "message", value: "", maxChars: 50, onChange: fn(), onSend: fn(), onStop: fn() },
  parameters: { layout: "padded" },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Enter sends; Shift+Enter adds a line instead. */
export const Empty: Story = {
  play: async ({ args, canvas }) => {
    const box = canvas.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "Hello{Shift>}{Enter}{/Shift}there");
    await expect(box).toHaveValue("Hello\nthere");
    await expect(args.onSend).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    await expect(args.onSend).toHaveBeenCalledTimes(1);
  },
};

export const SendButton: Story = {
  args: { value: "Which services will you offer?" },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(args.onSend).toHaveBeenCalledTimes(1);
  },
};

/** Near the limit, a count appears and is read with the box. */
export const NearLimit: Story = {
  args: { value: "This message is getting close to the limit" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Message" })).toHaveAccessibleDescription(/42\/50 characters/);
  },
};

export const TooLong: Story = {
  args: { value: "This message is much too long for the fifty character limit", error: "Keep your message to 50 characters (it has 59)." },
  play: async ({ canvas }) => {
    const box = canvas.getByRole("textbox", { name: "Message" });
    await expect(box).toHaveAttribute("aria-invalid", "true");
    await expect(box).toHaveAccessibleDescription(/Keep your message to 50 characters/);
  },
};

/** While a reply streams: Send becomes Stop, and Enter doesn't send. */
export const Streaming: Story = {
  args: { streaming: true, value: "Next question" },
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Message" }), "{Enter}");
    await expect(args.onSend).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Stop the reply" }));
    await expect(args.onStop).toHaveBeenCalledTimes(1);
  },
};
