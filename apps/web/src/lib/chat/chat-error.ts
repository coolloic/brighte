// The chat route's error codes, and what the page says for each. Shared by both (no server-only imports).

export type ChatErrorCode = "BAD_REQUEST" | "MODEL_UNAVAILABLE" | "RATE_LIMITED" | "PROVIDER_ERROR" | "NETWORK_ERROR" | "INTERRUPTED";

export type ChatErrorBody = { code: ChatErrorCode; retryAfterSeconds?: number };

/** User-facing copy for a failed message. Never shows provider error details. */
export function chatErrorMessage({ code, retryAfterSeconds }: ChatErrorBody): string {
  switch (code) {
    case "RATE_LIMITED": {
      const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
      return `You've sent a lot of messages. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "MODEL_UNAVAILABLE":
      return "That model isn't available any more. Pick another one and try again.";
    case "INTERRUPTED":
      return "The reply was cut off. Please try again.";
    case "NETWORK_ERROR":
      return "We couldn't reach the assistant. Check your connection and try again.";
    case "BAD_REQUEST":
    case "PROVIDER_ERROR":
      return "The assistant couldn't answer just now. Please try again in a moment.";
  }
}
