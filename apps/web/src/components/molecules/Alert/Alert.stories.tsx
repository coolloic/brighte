import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { Alert } from "./Alert";

const meta = {
  title: "Molecules/Alert",
  component: Alert,
  args: { tone: "error", title: "We couldn't send your registration", children: "Check your connection and try again." },
  render: (args) => (
    <div className="w-full max-w-xl">
      <Alert {...args} />
    </div>
  ),
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't send your registration");
  },
};

export const ErrorWithRetry: Story = {
  args: {
    action: (
      <Button variant="secondary" onClick={fn()}>
        Try again
      </Button>
    ),
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
  },
};

export const Success: Story = {
  args: { tone: "success", title: "Thanks, you're registered", children: "We'll email you when Brighte Eats launches." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Thanks, you're registered");
  },
};

export const Info: Story = { args: { tone: "info", title: "You're already registered", children: "We have your details: nothing more to do." } };

export const Warning: Story = { args: { tone: "warning", title: "Too many attempts", children: "Please wait a minute before trying again." } };
