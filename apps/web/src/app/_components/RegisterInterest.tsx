"use client";

import { startTransition, useActionState } from "react";
import { RegistrationForm, type FormAlert } from "@/components/organisms/RegistrationForm";
import type { ServiceOption } from "@/components/molecules/ServicePicker";
import { registerAction } from "@/app/actions";
import { registrationToFormData, type RegistrationState, type RegistrationValues } from "@/lib/registration";
import { RetryCountdown } from "./RetryCountdown";

const IDLE: RegistrationState = { status: "idle" };

/**
 * Connects RegistrationForm to the register Server Action. With JavaScript the form stays on the
 * page and the action runs in the background; without it, the browser posts the form to the same
 * action and the page comes back with the result.
 */
export function RegisterInterest({ serviceOptions }: { serviceOptions: ServiceOption[] }) {
  const [state, formAction, submitting] = useActionState(registerAction, IDLE);

  const submit = (values: RegistrationValues) => startTransition(() => formAction(registrationToFormData(values)));

  const error = state.status === "error" ? state : undefined;
  const formAlert: FormAlert | undefined = error?.alert && {
    tone: error.alert.tone,
    title: error.alert.title,
    // Rate limited: count down in the browser (a new countdown for each attempt).
    message: error.alert.retryAfter ? <RetryCountdown key={error.id} seconds={error.alert.retryAfter} /> : error.alert.message,
    onRetry: error.alert.retryable ? () => submit(error.values) : undefined,
  };

  return (
    <RegistrationForm
      serviceOptions={serviceOptions}
      action={formAction}
      onSubmit={submit}
      submitting={submitting}
      success={state.status === "success"}
      fieldErrors={error?.fieldErrors}
      formAlert={formAlert}
      // Without JavaScript the page is rendered again after a failed submit: keep what was typed.
      defaultValues={error?.values}
    />
  );
}
