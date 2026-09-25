"use client";

import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Alert } from "@/components/molecules/Alert";
import { FormField } from "@/components/molecules/FormField";

export type SignInFormValues = { email: string; password: string };
export type SignInFormField = keyof SignInFormValues;

/** A problem with the whole attempt, e.g. a wrong email or password. */
export type SignInFormAlert = {
  tone: "error" | "warning";
  title: string;
  message?: ReactNode;
};

export type SignInFormProps = {
  onSubmit: (values: SignInFormValues) => void;
  /** Where the form posts without JavaScript, e.g. a Server Action. Once hydrated, onSubmit handles the submit. */
  action?: ComponentProps<"form">["action"];
  fieldErrors?: Partial<Record<SignInFormField, string>>;
  alert?: SignInFormAlert;
  submitting?: boolean;
  /** Pre-filled email, e.g. after a failed attempt. The password always starts empty. */
  defaultEmail?: string;
};

const FIELD_ORDER: SignInFormField[] = ["email", "password"];

/**
 * Admin sign-in: email and password. Presentational, like RegistrationForm: results come in as props.
 * After a failed attempt (an alert), focus goes to the password so it can be typed again.
 */
export function SignInForm({ onSubmit, action, fieldErrors = {}, alert, submitting = false, defaultEmail = "" }: SignInFormProps) {
  const [values, setValues] = useState<SignInFormValues>({ email: defaultEmail, password: "" });
  const formRef = useRef<HTMLFormElement>(null);

  const firstInvalid = FIELD_ORDER.find((field) => fieldErrors[field]);
  useEffect(() => {
    const target = firstInvalid ?? (alert ? "password" : undefined);
    if (target) formRef.current?.querySelector<HTMLElement>(`#${target}`)?.focus();
  }, [firstInvalid, fieldErrors, alert]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    // noValidate: errors show in Brighte's style below each field instead of browser bubbles.
    <form ref={formRef} noValidate action={action} onSubmit={submit} aria-busy={submitting || undefined} className="space-y-5">
      {alert && (
        <Alert tone={alert.tone} title={alert.title}>
          {alert.message}
        </Alert>
      )}
      <fieldset disabled={submitting} className="space-y-5">
        <FormField
          id="email"
          name="email"
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="username"
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          name="password"
          label="Password"
          required
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
          error={fieldErrors.password}
        />
      </fieldset>
      <Button type="submit" fullWidth loading={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
