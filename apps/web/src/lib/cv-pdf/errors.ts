// The PDF route's error codes and how the page says them. Browser-safe.

export type CvPdfErrorCode = "BAD_REQUEST" | "TOO_LARGE" | "RATE_LIMITED" | "HAS_BLOCKING_FLAGS" | "UNSUPPORTED_CHARACTERS" | "RENDER_FAILED";
export type CvPdfErrorBody = {
  code: CvPdfErrorCode;
  retryAfterSeconds?: number;
  /** UNSUPPORTED_CHARACTERS: the ones the PDF font can't show (at most 10). */
  characters?: string[];
};

export function cvPdfErrorMessage({ code, retryAfterSeconds = 60, characters = [] }: CvPdfErrorBody): string {
  switch (code) {
    case "HAS_BLOCKING_FLAGS":
      return "Fix the things to check first.";
    case "UNSUPPORTED_CHARACTERS":
      // Naming them: one "✓" is easy to fix once you know it's the problem.
      return characters.length
        ? `The PDF font can't show some characters here: ${characters.join(" ")}. Ask me to replace them, then download again.`
        : "The PDF font can't show some characters here. Ask me to replace them, then download again.";
    case "RATE_LIMITED": {
      const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return `You've made a lot of PDFs. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    default:
      return "The PDF couldn't be made. Please try again.";
  }
}
