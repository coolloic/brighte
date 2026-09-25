import { BROWSER_REPORTS_PATH, type BrowserErrorReport, type BrowserReport, type WebVitalReport } from "./browser-reports";

type Payload = Omit<BrowserErrorReport, "page" | "requestId"> | Omit<WebVitalReport, "page" | "requestId">;

/** An error at most this many times per page load, however often it happens (an error in a loop). */
const MAX_ERRORS_PER_PAGE = 10;
const sentErrors = new Set<string>();

/**
 * Sends a report to the web server (src/app/api/browser-reports/route.ts), with the page's path
 * (no query) and its request id from the <meta name="request-id"> the root layout renders.
 * sendBeacon still delivers while the page unloads; fetch with keepalive is the fallback.
 * Never throws: reporting must not break the page.
 */
export function sendBrowserReport(payload: Payload) {
  try {
    if (payload.type === "error") {
      const key = `${payload.message}\n${payload.stack ?? ""}`;
      if (sentErrors.has(key) || sentErrors.size >= MAX_ERRORS_PER_PAGE) return;
      sentErrors.add(key);
    }
    const requestId = document.querySelector<HTMLMetaElement>('meta[name="request-id"]')?.content;
    const report: BrowserReport = { ...payload, page: location.pathname, ...(requestId && { requestId }) } as BrowserReport;
    const body = JSON.stringify(report);
    if (!navigator.sendBeacon?.(BROWSER_REPORTS_PATH, body)) {
      void fetch(BROWSER_REPORTS_PATH, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Nothing to do: the report is lost, the page carries on.
  }
}

/** A thrown value as report fields. */
export function errorPayload(kind: BrowserErrorReport["kind"], error: unknown): Omit<BrowserErrorReport, "page" | "requestId"> {
  if (error instanceof Error) return { type: "error", kind, name: error.name, message: error.message || error.name, stack: error.stack };
  return { type: "error", kind, message: String(error) || "Unknown error" };
}
