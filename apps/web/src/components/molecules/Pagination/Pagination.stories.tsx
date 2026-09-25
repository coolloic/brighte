import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Pagination } from "./Pagination";

const meta = {
  title: "Molecules/Pagination",
  component: Pagination,
  args: { page: 2, pageSize: 20, total: 97, itemLabel: "leads", hrefFor: (page: number) => `?page=${page}` },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MiddlePage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("Showing 21–40 of 97 leads");
    await expect(canvas.getByText("Page 2 of 5")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "?page=1");
    await expect(canvas.getByRole("link", { name: "Next" })).toHaveAttribute("href", "?page=3");
  },
};

export const FirstPage: Story = {
  args: { page: 1 },
  play: async ({ canvas }) => {
    // Nowhere to go back to: shown, but not a link.
    await expect(canvas.queryByRole("link", { name: "Previous" })).toBeNull();
    await expect(canvas.getByText("Previous").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
  },
};

export const LastPage: Story = {
  args: { page: 5 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation")).toHaveTextContent("Showing 81–97 of 97 leads");
    await expect(canvas.queryByRole("link", { name: "Next" })).toBeNull();
  },
};

export const NoResults: Story = {
  args: { page: 1, total: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No leads")).toBeInTheDocument();
    await expect(canvas.getByText("Page 1 of 1")).toBeInTheDocument();
  },
};
