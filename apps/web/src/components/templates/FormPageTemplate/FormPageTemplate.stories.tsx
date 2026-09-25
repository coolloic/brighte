import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { RegistrationForm } from "@/components/organisms/RegistrationForm";
import { SERVICE_OPTIONS } from "@/stories/fixtures/leads";
import { FormPageTemplate } from "./FormPageTemplate";

const meta = {
  title: "Templates/FormPageTemplate",
  component: FormPageTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Register your interest in Brighte Eats",
    intro: "Tell us which services you'd use and we'll let you know as soon as Brighte Eats launches near you.",
    highlights: ["Delivery, pick-up and payment options", "Be first to hear when we launch", "No commitment: it takes a minute"],
    children: <RegistrationForm serviceOptions={SERVICE_OPTIONS} onSubmit={fn()} />,
  },
} satisfies Meta<typeof FormPageTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RegisterPage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("banner")).toBeInTheDocument();
    await expect(canvas.getByRole("main")).toBeInTheDocument();
    await expect(canvas.getByRole("contentinfo")).toBeInTheDocument();
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expect(canvas.getByRole("region", { name: "Register your interest in Brighte Eats" })).toContainElement(
      canvas.getByRole("button", { name: "Register interest" }),
    );

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
