import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Molecules/EmptyState",
  component: EmptyState,
  args: { title: "No leads yet", message: "Leads appear here as soon as someone registers their interest." },
  render: (args) => (
    <div className="w-full max-w-xl">
      <EmptyState {...args} />
    </div>
  ),
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoLeads: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 2, name: "No leads yet" })).toBeInTheDocument();
  },
};

export const NoMatchesForFilter: Story = {
  args: {
    title: "No leads for Pick-up",
    message: "Nobody has chosen this service yet.",
    action: (
      <a href="?" className="font-semibold text-fg-brand underline focus-visible:focus-ring">
        Show all services
      </a>
    ),
  },
};
