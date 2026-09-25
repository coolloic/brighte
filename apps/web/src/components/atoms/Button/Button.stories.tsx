import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { contrast, readToken } from "../../../stories/foundations/color";
import { Button } from "./Button";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { children: "Register interest", onClick: fn() },
  argTypes: { variant: { control: "inline-radio", options: ["primary", "secondary", "ghost"] } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The token's color as the browser reports computed colors. */
const rgb = (token: string) => `rgb(${readToken(token)!.join(", ")})`;

export const Primary: Story = {
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Register interest" });
    await expect(getComputedStyle(button).backgroundColor).toBe(rgb("action"));
    await expect(getComputedStyle(button).color).toBe(rgb("on-action"));
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // The label must stay WCAG "large text" (>= 18.66px bold): that is what makes 4.95:1 AAA.
    await expect(parseFloat(getComputedStyle(button).fontSize)).toBeGreaterThanOrEqual(18.66);
    await expect(Number(getComputedStyle(button).fontWeight)).toBeGreaterThanOrEqual(700);
    await expect(contrast(readToken("on-action")!, readToken("action")!)).toBeGreaterThanOrEqual(4.5);

    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    // Keyboard: Tab reaches it, the focus ring is the focus token, Enter activates it.
    button.blur();
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(button).outlineColor).toBe(rgb("focus"));
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

export const Secondary: Story = { args: { variant: "secondary", children: "Cancel" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Try again" } };

export const Loading: Story = {
  args: { loading: true, children: "Submitting…" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Submitting…" });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(getComputedStyle(button).opacity).toBe("1");
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const FullWidth: Story = {
  args: { fullWidth: true },
  parameters: { layout: "padded" },
};
