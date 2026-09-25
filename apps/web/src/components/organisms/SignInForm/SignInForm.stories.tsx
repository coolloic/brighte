import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { SignInForm } from "./SignInForm";

const meta = {
  title: "Organisms/SignInForm",
  component: SignInForm,
  args: { onSubmit: fn() },
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="mx-auto w-full max-w-md">
      <SignInForm {...args} />
    </div>
  ),
} satisfies Meta<typeof SignInForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// Password inputs have no textbox role, and the label's text includes the required "*" (hidden from
// screen readers), so they are found by label text starting with "Password".

/** An admin typing their details and pressing Enter. */
export const Empty: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Email" }), "admin@brighte.dev");
    const password = canvas.getByLabelText(/^Password/);
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    // The eye button shows what was typed.
    await userEvent.type(password, "secret-password");
    await userEvent.click(canvas.getByRole("button", { name: "Show password" }));
    await expect(password).toHaveAttribute("type", "text");
    await userEvent.type(password, "{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith({ email: "admin@brighte.dev", password: "secret-password" });
  },
};

/** Focus goes to the first problem. */
export const FieldErrors: Story = {
  args: {
    defaultEmail: "admin@",
    fieldErrors: { email: "Enter a valid email address", password: "Enter your password" },
  },
  play: async ({ canvas }) => {
    const email = canvas.getByRole("textbox", { name: "Email" });
    await expect(email).toHaveFocus();
    await expect(email).toHaveAccessibleDescription("Enter a valid email address");
    await expect(canvas.getByLabelText(/^Password/)).toHaveAccessibleDescription("Enter your password");
  },
};

/** After a failed attempt: the email stays, the password is empty and focused, and the alert is announced. */
export const WrongCredentials: Story = {
  args: {
    defaultEmail: "admin@brighte.dev",
    alert: { tone: "error", title: "Email or password is incorrect", message: "Check them and try again." },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Email or password is incorrect");
    await expect(canvas.getByRole("textbox", { name: "Email" })).toHaveValue("admin@brighte.dev");
    await expect(canvas.getByLabelText(/^Password/)).toHaveValue("");
    await expect(canvas.getByLabelText(/^Password/)).toHaveFocus();
  },
};

export const NotAnAdmin: Story = {
  args: {
    defaultEmail: "user@brighte.dev",
    alert: { tone: "error", title: "This account can't view leads", message: "Sign in with an admin account." },
  },
};

export const RateLimited: Story = {
  args: {
    defaultEmail: "admin@brighte.dev",
    alert: { tone: "warning", title: "Too many attempts", message: "Please wait 2 minutes and try again." },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Too many attempts");
  },
};

/** While signing in: fields and button disabled, the button says so. */
export const Submitting: Story = {
  args: { defaultEmail: "admin@brighte.dev", submitting: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: "Email" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Signing in…" }).closest("form")).toHaveAttribute("aria-busy", "true");
  },
};
