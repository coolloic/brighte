// The /api/my-data route's codes and how the page says them. Browser-safe.

export type MyDataErrorCode = "BAD_REQUEST" | "NO_EMAIL" | "HAS_BLOCKING_FLAGS" | "OFF" | "UNAVAILABLE";

export type MyDataErrorBody = { code: MyDataErrorCode };

export function myDataErrorMessage({ code }: MyDataErrorBody): string {
  switch (code) {
    case "NO_EMAIL":
      return "Your profile has no email, which is how your data is saved. Tell me your email (e.g. \"my email is …\") and save the new profile.";
    case "HAS_BLOCKING_FLAGS":
      return "Fix the things to check first.";
    case "OFF":
      return "Saving to my data is turned off.";
    case "UNAVAILABLE":
    case "BAD_REQUEST":
      return "It couldn't be saved just now. Please try again in a moment.";
  }
}
