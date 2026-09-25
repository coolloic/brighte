import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Skeleton } from "./Skeleton";

const meta = {
  title: "Atoms/Skeleton",
  component: Skeleton,
  args: { className: "h-4 w-48" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-hidden='true']")).not.toBeNull();
  },
};

/** A loading lead card: the region says it is busy, and screen readers hear "Loading lead" instead of grey boxes. */
export const LoadingCard: Story = {
  render: () => (
    <div aria-busy="true" className="w-80 max-w-full space-y-3 rounded-card border border-border p-4">
      <span className="sr-only">Loading lead</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-busy='true']")).not.toBeNull();
    await expect(canvas.getByText("Loading lead")).toBeInTheDocument();
  },
};
