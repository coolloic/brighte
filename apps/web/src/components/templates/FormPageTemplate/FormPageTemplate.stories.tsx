import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { expect, fn, userEvent } from "storybook/test";
import { SignInForm } from "@/components/organisms/SignInForm";
import { FormPageTemplate } from "./FormPageTemplate";

const meta = {
  title: "Templates/FormPageTemplate",
  component: FormPageTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Admin sign in",
    intro: "For CV coach admins only.",
    children: <SignInForm onSubmit={fn()} />,
  },
} satisfies Meta<typeof FormPageTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignInPage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toBeInTheDocument();
    await expect(canvas.getByRole("main")).toBeInTheDocument();
    await expect(canvas.getByRole("contentinfo")).toBeInTheDocument();
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expect(canvas.getByRole("region", { name: "Admin sign in" })).toContainElement(canvas.getByRole("button", { name: "Sign in" }));

    // The skip link is the first stop for keyboard users and appears when focused.
    await userEvent.tab();
    const skip = canvas.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveFocus();
    // A 44px target once visible (not-sr-only would otherwise reset its padding to 0).
    await expect(skip.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // Following the link focuses its target in real browsers; the test iframe handles the fragment
    // asynchronously, so check the wiring instead: it points at <main>, which can take focus.
    await expect(skip).toHaveAttribute("href", "#main");
    await expect(canvas.getByRole("main")).toHaveAttribute("tabindex", "-1");
  },
};

/** A link on the right of the header. */
export const WithHeaderLink: Story = {
  args: { headerActions: <Link href="/">Back to the chat</Link> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toContainElement(canvas.getByRole("link", { name: "Back to the chat" }));
  },
};
