import type { ApiError } from "./errors";

// What the register page shows for a failed registration. Kept as plain data (no functions) so a
// Server Action can return it to the form. Structurally matches RegistrationForm's props.

export type RegistrationFieldName = "name" | "email" | "mobile" | "postcode" | "services";

export type RegistrationAlert = {
  tone: "error" | "warning";
  title: string;
  message: string;
  /** Show "Try again": resubmitting the same values may work (e.g. the API was briefly down). */
  retryable: boolean;
};

export type RegistrationFeedback = {
  fieldErrors?: Partial<Record<RegistrationFieldName, string>>;
  alert?: RegistrationAlert;
};

const FIELDS = new Set<string>(["name", "email", "mobile", "postcode", "services"]);

/** Maps an API error from `register` to messages next to the fields, or one alert above the form. */
export function registrationFeedback(error: ApiError): RegistrationFeedback {
  switch (error.code) {
    case "BAD_USER_INPUT": {
      const entries = Object.entries(error.fields ?? {}).filter(([field]) => FIELDS.has(field));
      if (entries.length === 0) {
        return {
          alert: {
            tone: "error",
            title: "Some details weren't accepted",
            message: "Check the form and try again.",
            retryable: false,
          },
        };
      }
      return { fieldErrors: Object.fromEntries(entries.map(([field, message]) => [field, withoutExample(message)])) };
    }
    case "CONFLICT":
      return { fieldErrors: { email: "This email has already registered interest. Use a different email." } };
    case "TOO_MANY_REQUESTS":
      return {
        alert: {
          tone: "warning",
          title: "Too many attempts",
          message: `Please wait ${waitTime(error.retryAfter)} and try again.`,
          retryable: false,
        },
      };
    default:
      // NETWORK_ERROR, INTERNAL_SERVER_ERROR, and anything unexpected for a public operation.
      return {
        alert: {
          tone: "error",
          title: "We couldn't send your registration",
          message: "Something went wrong on our side. Your details are still here, so please try again.",
          retryable: true,
        },
      };
  }
}

// The form shows an example under each field as a hint, so an error doesn't repeat it:
// "Enter an Australian mobile number, e.g. 0412 345 678" becomes "Enter an Australian mobile number".
function withoutExample(message: string): string {
  return message.replace(/,?\s*e\.g\..*$/, "");
}

function waitTime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "a minute";
  if (seconds < 60) return seconds === 1 ? "1 second" : `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}
