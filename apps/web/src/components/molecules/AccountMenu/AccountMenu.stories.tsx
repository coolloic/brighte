import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { AccountMenu } from "./AccountMenu";

const meta = {
  title: "Molecules/AccountMenu",
  component: AccountMenu,
  args: { name: "Grace Hopper", email: "grace.hopper@brighte.com.au", signOutAction: fn() },
  // Room for the open panel, which drops below the avatar at the right edge.
  render: (args) => (
    <div className="flex h-64 justify-end p-4">
      <AccountMenu {...args} />
    </div>
  ),
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: just the avatar. Opening shows who is signed in and Sign out. */
export const Default: Story = {
  play: async ({ args, canvas, canvasElement }) => {
    const details = canvasElement.querySelector("details")!;
    const summary = canvasElement.querySelector("summary")!;
    await expect(summary).toHaveTextContent("GH");
    await expect(summary).toHaveTextContent("Account menu for Grace Hopper");
    await expect(summary.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(details.open).toBe(false);

    await userEvent.click(summary);
    await expect(details.open).toBe(true);
    await expect(canvas.getByText("grace.hopper@brighte.com.au")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
    await expect(args.signOutAction).toHaveBeenCalled();

    await userEvent.click(summary);
    await expect(details.open).toBe(false);
    // Enter/Space on <summary> is the browser's own behaviour, which simulated key events don't
    // trigger; it is covered with real key presses in e2e/admin-sign-in.spec.ts.
  },
};

/** Closes like a menu: on a click outside, on Escape (focus back on the avatar), and when focus leaves it. */
export const ClosesLikeAMenu: Story = {
  render: (args) => (
    // Something focusable after the menu, like the page content in a real header.
    <div className="flex h-64 flex-col p-4">
      <div className="flex items-start justify-between">
        <button type="button">Somewhere else</button>
        <AccountMenu {...args} />
      </div>
      <a href="#content" className="mt-auto">
        Page content
      </a>
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const details = canvasElement.querySelector("details")!;
    const summary = canvasElement.querySelector("summary")!;

    await userEvent.click(summary);
    await expect(details.open).toBe(true);
    await userEvent.click(canvas.getByText("grace.hopper@brighte.com.au"));
    await expect(details.open).toBe(true); // a click inside keeps it open
    await userEvent.click(canvas.getByRole("button", { name: "Somewhere else" }));
    await expect(details.open).toBe(false);

    await userEvent.click(summary);
    await userEvent.keyboard("{Escape}");
    await expect(details.open).toBe(false);
    await expect(summary).toHaveFocus();

    await userEvent.click(summary);
    await userEvent.tab(); // to Sign out: still inside
    await expect(details.open).toBe(true);
    await userEvent.tab(); // out of the menu
    await expect(details.open).toBe(false);
  },
};

/** One-word names get one initial. */
export const SingleName: Story = { args: { name: "Admin", email: "admin@brighte.dev" } };
