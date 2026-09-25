import type { RegistrationFeedback, RegistrationFieldName } from "@/lib/api/registration-feedback";

// Shared by the register page's Server Action and its client wrapper (no server-only imports).

export type RegistrationValues = {
  name: string;
  email: string;
  mobile: string;
  postcode: string;
  services: string[];
};

/** What the register Server Action returns: rendered by the form with or without JavaScript. */
export type RegistrationState =
  | { status: "idle" }
  | { status: "success" }
  | ({
      status: "error";
      /** New for every failed submit, so per-attempt UI (the retry countdown) starts over. */
      id: string;
      values: RegistrationValues;
    } & RegistrationFeedback);

/** Reads the form's fields. A Server Action is a public endpoint: anything that isn't a string is dropped. */
export function registrationFromFormData(formData: FormData): RegistrationValues {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    email: text("email"),
    mobile: text("mobile"),
    postcode: text("postcode"),
    services: formData.getAll("services").filter((value): value is string => typeof value === "string"),
  };
}

/** The same fields as a native submit sends, so both paths reach the action with the same data. */
export function registrationToFormData(values: RegistrationValues): FormData {
  const formData = new FormData();
  formData.set("name", values.name);
  formData.set("email", values.email);
  formData.set("mobile", values.mobile);
  formData.set("postcode", values.postcode);
  for (const code of values.services) formData.append("services", code);
  return formData;
}

// The API's rules (apps/api/src/leads/leads.schemas.ts), checked in the browser before anything is
// sent: mistakes show at once and never count against the API's rate limit. Not a security
// boundary: the API validates every request again and stays the source of truth. Messages match
// the API's, without the examples the field hints already show.
const AU_MOBILE = /^(?:\+?61|0)4\d{8}$/;
// zod's default email pattern, which the API uses.
const EMAIL = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

/** Field errors for values the API would reject; empty when the values look valid. */
export function validateRegistration(values: RegistrationValues): Partial<Record<RegistrationFieldName, string>> {
  const errors: Partial<Record<RegistrationFieldName, string>> = {};
  const name = values.name.trim();
  if (!name) errors.name = "Name is required";
  else if (name.length > 255) errors.name = "Name is too long";

  const email = values.email.trim();
  if (email.length > 255) errors.email = "Email is too long";
  else if (!EMAIL.test(email)) errors.email = "Enter a valid email address";

  if (!AU_MOBILE.test(values.mobile.replace(/[\s()-]/g, ""))) errors.mobile = "Enter an Australian mobile number";
  if (!/^\d{4}$/.test(values.postcode.trim())) errors.postcode = "Enter a 4-digit postcode";
  if (values.services.length === 0) errors.services = "Choose at least one service";
  return errors;
}
