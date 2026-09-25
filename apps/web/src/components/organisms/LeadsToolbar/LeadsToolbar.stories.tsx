import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { SERVICE_OPTIONS } from "@/stories/fixtures/leads";
import { LeadsToolbar } from "./LeadsToolbar";

const meta = {
  title: "Organisms/LeadsToolbar",
  component: LeadsToolbar,
  args: {
    serviceOptions: SERVICE_OPTIONS,
    hrefFor: (code?: string) => (code ? `?service=${code}` : "?"),
    total: 97,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LeadsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllServices: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "All services" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByText("97 leads")).toBeInTheDocument();
  },
};

export const FilteredToOne: Story = {
  args: { selectedService: "pick-up", total: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Pick-up" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByText("1 lead")).toBeInTheDocument();
  },
};
