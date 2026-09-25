import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { expect, fn, userEvent } from "storybook/test";
import { Button, buttonVariants } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { readToken } from "@/stories/foundations/color";
import { StatusPageTemplate } from "./StatusPageTemplate";

const meta = {
  title: "Templates/StatusPageTemplate",
  component: StatusPageTemplate,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StatusPageTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

const rgb = (token: string) => `rgb(${readToken(token)!.join(", ")})`;

/** app/not-found.tsx */
export const NotFound: Story = {
  args: {
    title: "Sorry, we can't find that page",
    action: (
      <Link href="/" className={buttonVariants()}>
        Back to home
        <Icon name="chevron-right" />
      </Link>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Sorry, we can't find that page");
    const home = canvas.getByRole("link", { name: "Back to home" });
    await expect(home).toHaveAttribute("href", "/");

    // On the dark panel the focus ring is white: the usual green would be under 3:1 there.
    await userEvent.tab(); // skip link
    await userEvent.tab(); // logo
    await userEvent.tab();
    await expect(home).toHaveFocus();
    await expect(getComputedStyle(home).outlineColor).toBe(rgb("focus-inverse"));
  },
};

/** app/error.tsx */
export const SomethingWentWrong: Story = {
  args: {
    title: "Something went wrong, please try again later",
    action: (
      <Button onClick={fn()}>
        Try again
        <Icon name="chevron-right" />
      </Button>
    ),
  },
};
