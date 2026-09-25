"use client";

import { startTransition, useActionState, useState } from "react";
import { SignInForm, type SignInFormAlert } from "@/components/organisms/SignInForm";
import { RetryCountdown } from "@/app/_components/RetryCountdown";
import { signInToFormData, validateSignIn, type SignInState, type SignInValues } from "@/lib/sign-in";

const IDLE: SignInState = { status: "idle" };

/**
 * Connects SignInForm to the sign-in Server Action (bound to where to go next). With JavaScript the
 * values are checked in the browser first; without it, the browser posts to the same action.
 */
export function SignIn({ action }: { action: (state: SignInState, formData: FormData) => Promise<SignInState> }) {
  const [state, formAction, submitting] = useActionState(action, IDLE);
  const [browserErrors, setBrowserErrors] = useState<ReturnType<typeof validateSignIn>>();

  const submit = (values: SignInValues) => {
    const errors = validateSignIn(values);
    if (Object.keys(errors).length > 0) {
      setBrowserErrors(errors);
      return;
    }
    setBrowserErrors(undefined);
    startTransition(() => formAction(signInToFormData(values)));
  };

  const error = state.status === "error" ? state : undefined;
  const alert: SignInFormAlert | undefined =
    !browserErrors && error?.alert
      ? {
          tone: error.alert.tone,
          title: error.alert.title,
          message: error.alert.retryAfter ? <RetryCountdown key={error.id} seconds={error.alert.retryAfter} /> : error.alert.message,
        }
      : undefined;

  return (
    <SignInForm
      // A fresh form for every failed attempt, so the password starts empty.
      key={error?.id ?? "idle"}
      action={formAction}
      onSubmit={submit}
      submitting={submitting}
      fieldErrors={browserErrors ?? error?.fieldErrors}
      alert={alert}
      defaultEmail={error?.email}
    />
  );
}
