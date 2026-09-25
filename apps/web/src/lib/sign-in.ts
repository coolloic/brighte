import type { SignInAlert } from "@/lib/api/sign-in-feedback";

// Shared by the sign-in Server Action and its client wrapper (no server-only imports).

export type SignInValues = { email: string; password: string };
export type SignInField = keyof SignInValues;

/** What the sign-in Server Action returns. Success redirects instead. Never includes the password. */
export type SignInState =
  | { status: "idle" }
  | {
      status: "error";
      /** New for every failed attempt: the form starts over (password cleared) for each one. */
      id: string;
      email: string;
      fieldErrors?: Partial<Record<SignInField, string>>;
      alert?: SignInAlert;
    };

export function signInFromFormData(formData: FormData): SignInValues {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return { email: text("email"), password: text("password") };
}

export function signInToFormData(values: SignInValues): FormData {
  const formData = new FormData();
  formData.set("email", values.email);
  formData.set("password", values.password);
  return formData;
}

// zod's default email pattern, which the API uses.
const EMAIL = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

/** Checked in the browser before sending (and again by the Server Action): nothing counts against the login limit for a typo. */
export function validateSignIn(values: SignInValues): Partial<Record<SignInField, string>> {
  const errors: Partial<Record<SignInField, string>> = {};
  if (!EMAIL.test(values.email.trim())) errors.email = "Enter a valid email address";
  if (!values.password) errors.password = "Enter your password";
  return errors;
}

/**
 * Where to go after signing in: an admin path on this site, never another site (`?next=` comes from
 * the URL, so anyone can set it).
 */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/admin(?:[/?#]|$)/.test(next) && !next.includes("\\") ? next : "/admin";
}
