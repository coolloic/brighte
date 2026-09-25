import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ServiceFilter } from "./ServiceFilter";

const meta = {
  title: "Molecules/ServiceFilter",
  component: ServiceFilter,
  args: {
    options: [
      { code: "delivery", label: "Delivery" },
      { code: "pick-up", label: "Pick-up" },
      { code: "payment", label: "Payment" },
    ],
    hrefFor: (code?: string) => (code ? `?service=${code}` : "?"),
  },
} satisfies Meta<typeof ServiceFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllServices: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Filter by service" })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "All services" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("link", { name: "Delivery" })).toHaveAttribute("href", "?service=delivery");
  },
};

export const OneSelected: Story = {
  args: { selected: "pick-up" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Pick-up" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("link", { name: "All services" })).not.toHaveAttribute("aria-current");
    // Not color alone: the current chip also shows a tick.
    await expect(canvas.getByRole("link", { name: "Pick-up" }).querySelector("svg")).not.toBeNull();
  },
};
