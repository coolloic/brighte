import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { RegistrationForm } from "./RegistrationForm";

const meta = {
  title: "Organisms/RegistrationForm",
  component: RegistrationForm,
  args: {
    serviceOptions: [
      { code: "delivery", label: "Delivery" },
      { code: "pick-up", label: "Pick-up" },
      { code: "payment", label: "Payment" },
    ],
    onSubmit: fn(),
  },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="mx-auto w-full max-w-xl">
      <RegistrationForm {...args} />
    </div>
  ),
} satisfies Meta<typeof RegistrationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const filled = { name: "Ada Lovelace", email: "ada@example.com", mobile: "0412 345 678", postcode: "2000", services: ["delivery"] };

/** A user filling the form in and submitting it. */
export const Empty: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Full name" }), "Ada Lovelace");
    await userEvent.type(canvas.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await userEvent.type(canvas.getByRole("textbox", { name: "Mobile number" }), "0412 345 678");
    await userEvent.type(canvas.getByRole("textbox", { name: "Postcode" }), "2000");
    await userEvent.click(canvas.getByText("Delivery"));
    await userEvent.click(canvas.getByText("Payment"));
    await userEvent.click(canvas.getByRole("button", { name: "Register interest" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ ...filled, services: ["delivery", "payment"] });
  },
};

export const EnterSubmits: Story = {
  args: { defaultValues: filled },
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Postcode" }), "{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith(filled);
  },
};

/** After a submit with problems: each field shows its error, and focus goes to the first one. */
export const FieldErrors: Story = {
  args: {
    defaultValues: { ...filled, email: "ada@", mobile: "123", services: [] },
    fieldErrors: {
      email: "Enter a valid email address",
      mobile: "Enter an Australian mobile number",
      services: "Choose at least one service",
    },
  },
  play: async ({ canvas }) => {
    const email = canvas.getByRole("textbox", { name: "Email" });
    await expect(email).toHaveFocus();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Enter a valid email address");
    // The error says what's wrong; the hint above it already gives the example.
    await expect(canvas.getByRole("textbox", { name: "Mobile number" })).toHaveAccessibleDescription(
      "Enter an Australian mobile number e.g. 0412 345 678",
    );
    await expect(canvas.getByRole("group", { name: "Which services are you interested in?" })).toHaveAccessibleDescription(
      "Choose at least one service Choose one or more.",
    );
    // Fields without errors stay valid.
    await expect(canvas.getByRole("textbox", { name: "Full name" })).not.toHaveAttribute("aria-invalid");
  },
};

/** The API said the email is taken (CONFLICT): shown on the email field. */
export const DuplicateEmail: Story = {
  args: { defaultValues: filled, fieldErrors: { email: "This email is already registered. You don't need to register again." } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Email" })).toHaveFocus();
  },
};

export const Submitting: Story = {
  args: { defaultValues: filled, submitting: true },
  play: async ({ args, canvas, canvasElement }) => {
    const button = canvas.getByRole("button", { name: "Submitting…" });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(canvasElement.querySelector("form")).toHaveAttribute("aria-busy", "true");
    // Announced wherever focus is.
    await expect(canvas.getByRole("status")).toHaveTextContent("Submitting your registration…");
    // Nothing is disabled, so focus stays where it was; a second submit, by click or Enter, is ignored.
    await expect(canvas.getByRole("textbox", { name: "Email" })).toBeEnabled();
    await userEvent.click(button);
    await expect(button).toHaveFocus();
    await userEvent.type(canvas.getByRole("textbox", { name: "Postcode" }), "{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const NetworkError: Story = {
  args: {
    defaultValues: filled,
    formAlert: { tone: "error", title: "We couldn't send your registration", message: "Check your connection and try again.", onRetry: fn() },
  },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't send your registration");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.formAlert!.onRetry).toHaveBeenCalledTimes(1);
  },
};

/** TOO_MANY_REQUESTS from the API: nothing to retry right away. */
export const RateLimited: Story = {
  args: {
    defaultValues: filled,
    formAlert: { tone: "warning", title: "Too many attempts", message: "Please wait a minute, then submit again." },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Too many attempts").closest("[role=status]")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Try again" })).toBeNull();
  },
};

export const Success: Story = {
  args: { success: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 2, name: "Thanks, you're registered" })).toHaveFocus();
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};
