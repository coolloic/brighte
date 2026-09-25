import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { Heading } from "@/components/atoms/Heading";
import { AppShell } from "./AppShell";

const meta = {
  title: "Templates/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: {
    children: <Heading level={1}>Page title</Heading>,
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toContainElement(canvas.getByRole("link", { name: "Brighte Eats" }));
    await expect(canvas.getByRole("main")).toHaveAttribute("id", "main");
    await expect(canvas.getByRole("contentinfo")).toBeInTheDocument();
  },
};

export const WithHeaderActions: Story = {
  args: { headerActions: <Button variant="ghost">Sign out</Button> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toContainElement(canvas.getByRole("button", { name: "Sign out" }));
  },
};
