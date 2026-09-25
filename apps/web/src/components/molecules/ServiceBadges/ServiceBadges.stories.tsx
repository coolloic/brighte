import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ServiceBadges } from "./ServiceBadges";

const meta = {
  title: "Molecules/ServiceBadges",
  component: ServiceBadges,
  args: {
    services: [
      { code: "delivery", label: "Delivery" },
      { code: "payment", label: "Payment" },
    ],
  },
} satisfies Meta<typeof ServiceBadges>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: "Services" }).querySelectorAll("li")).toHaveLength(2);
  },
};

export const None: Story = {
  args: { services: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No services")).toBeInTheDocument();
  },
};
