"use client";

import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Heading } from "@/components/atoms/Heading";
import { Icon } from "@/components/atoms/Icon";
import { Text } from "@/components/atoms/Text";
import { Alert, type AlertTone } from "@/components/molecules/Alert";
import { FormField } from "@/components/molecules/FormField";
import { ServicePicker, type ServiceOption } from "@/components/molecules/ServicePicker";

export type RegistrationValues = {
  name: string;
  email: string;
  mobile: string;
  postcode: string;
  services: string[];
};

export type RegistrationField = keyof RegistrationValues;

/** A message about the whole submission, e.g. a network failure. */
export type FormAlert = {
  tone: Extract<AlertTone, "error" | "warning" | "info">;
  title: string;
  message?: string;
  /** Shows a "Try again" button that calls this. */
  onRetry?: () => void;
};

export type RegistrationFormProps = {
  /** Active service types, e.g. from the serviceTypes query. */
  serviceOptions: ServiceOption[];
  onSubmit: (values: RegistrationValues) => void;
  /**
   * Where the form posts when JavaScript isn't running yet (or at all), e.g. a Server Action. Every
   * field has a `name`, so a plain browser submit sends the same values. Once hydrated, onSubmit
   * handles the submit instead.
   */
  action?: ComponentProps<"form">["action"];
  /** One message per invalid field. The first invalid field receives focus. */
  fieldErrors?: Partial<Record<RegistrationField, string>>;
  formAlert?: FormAlert;
  submitting?: boolean;
  /** Replaces the form with a confirmation, which receives focus. */
  success?: boolean;
  defaultValues?: Partial<RegistrationValues>;
};

// Focus order for errors: the first invalid field in the order they appear.
const FIELD_ORDER: RegistrationField[] = ["name", "email", "mobile", "postcode", "services"];

const EMPTY: RegistrationValues = { name: "", email: "", mobile: "", postcode: "", services: [] };

/**
 * The Brighte Eats registration form. Presentational: it keeps what the user types and reports it
 * through onSubmit; validation results, submission state and outcome come in as props, so every
 * state can be shown without a backend.
 */
export function RegistrationForm({
  serviceOptions,
  onSubmit,
  action,
  fieldErrors = {},
  formAlert,
  submitting = false,
  success = false,
  defaultValues,
}: RegistrationFormProps) {
  const [values, setValues] = useState<RegistrationValues>({ ...EMPTY, ...defaultValues });
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);

  // Take keyboard and screen-reader users to the first problem, as soon as errors arrive.
  const firstInvalid = FIELD_ORDER.find((field) => fieldErrors[field]);
  useEffect(() => {
    if (!firstInvalid) return;
    const target = firstInvalid === "services" ? "#services input" : `#${firstInvalid}`;
    formRef.current?.querySelector<HTMLElement>(target)?.focus();
  }, [firstInvalid, fieldErrors]);

  // Announce the confirmation by moving focus to it.
  useEffect(() => {
    if (success) confirmationRef.current?.focus();
  }, [success]);

  if (success) {
    return (
      <section aria-labelledby="registration-confirmation" className="rounded-card border border-success bg-success-surface p-6">
        <Heading
          level={2}
          size="md"
          id="registration-confirmation"
          ref={confirmationRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-success focus-visible:focus-ring"
        >
          <Icon name="check-circle" className="size-6" />
          Thanks, you&apos;re registered
        </Heading>
        <Text className="mt-2">We&apos;ll be in touch when Brighte Eats launches in your area.</Text>
      </section>
    );
  }

  const set = <K extends RegistrationField>(field: K, value: RegistrationValues[K]) => setValues((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    // noValidate: errors show in Brighte's style below each field instead of browser bubbles.
    <form ref={formRef} noValidate action={action} onSubmit={submit} aria-busy={submitting || undefined} className="space-y-5">
      <fieldset disabled={submitting} className="space-y-5">
        <FormField
          id="name"
          name="name"
          label="Full name"
          required
          autoComplete="name"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          error={fieldErrors.name}
        />
        <FormField
          id="email"
          name="email"
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => set("email", event.target.value)}
          error={fieldErrors.email}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="mobile"
            name="mobile"
            label="Mobile number"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint="e.g. 0412 345 678"
            value={values.mobile}
            onChange={(event) => set("mobile", event.target.value)}
            error={fieldErrors.mobile}
          />
          <FormField
            id="postcode"
            name="postcode"
            label="Postcode"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            hint="4 digits, e.g. 2000"
            value={values.postcode}
            onChange={(event) => set("postcode", event.target.value)}
            error={fieldErrors.postcode}
          />
        </div>
        <ServicePicker
          id="services"
          legend="Which services are you interested in?"
          required
          hint="Choose one or more."
          options={serviceOptions}
          value={values.services}
          onChange={(services) => set("services", services)}
          error={fieldErrors.services}
        />
      </fieldset>

      {formAlert && (
        <Alert
          tone={formAlert.tone}
          title={formAlert.title}
          action={
            formAlert.onRetry && (
              <Button variant="secondary" onClick={formAlert.onRetry}>
                Try again
              </Button>
            )
          }
        >
          {formAlert.message}
        </Alert>
      )}

      <div className="space-y-3">
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? "Submitting…" : "Register interest"}
          {!submitting && <Icon name="chevron-right" />}
        </Button>
        <Text size="sm" tone="muted">
          We&apos;ll only use your details to contact you about Brighte Eats.
        </Text>
      </div>
    </form>
  );
}
