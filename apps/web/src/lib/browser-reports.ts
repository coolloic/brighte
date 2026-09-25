import { isRequestId } from "./request-id";

// What the browser sends to the web server (src/app/api/browser-reports/route.ts): its uncaught
// errors and its Web Vitals. Shared by the sender (send-browser-report.ts) and the endpoint.

export const BROWSER_REPORTS_PATH = "/api/browser-reports";
/** Larger bodies are refused unread: a report is well under 1 KB, a long stack a few. */
export const MAX_REPORT_BYTES = 8 * 1024;

const ERROR_KINDS = ["error", "unhandledrejection", "boundary"] as const;
const VITALS = ["TTFB", "FCP", "LCP", "CLS", "INP", "FID"] as const;
const RATINGS = ["good", "needs-improvement", "poor"] as const;

type Context = {
  /** The page's path, without the query: the dashboard's ?q= holds searched names. */
  page: string;
  /** The page's request id (src/proxy.ts), which the web server's and API's logs for it carry. */
  requestId?: string;
};

export type BrowserErrorReport = Context & {
  type: "error";
  /** An uncaught error, an unhandled promise rejection, or an error the error page caught while rendering. */
  kind: (typeof ERROR_KINDS)[number];
  name?: string;
  message: string;
  stack?: string;
  /** The script, line and column it was thrown from (uncaught errors only). */
  source?: string;
  line?: number;
  column?: number;
};

export type WebVitalReport = Context & {
  type: "vital";
  name: (typeof VITALS)[number];
  value: number;
  rating: (typeof RATINGS)[number];
  /** Unique per metric and page load. */
  id: string;
  navigationType?: string;
};

export type BrowserReport = BrowserErrorReport | WebVitalReport;

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => values.includes(value as T);
const text = (value: unknown, max: number) => (typeof value === "string" && value.length > 0 ? value.slice(0, max) : undefined);
const count = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined);
const withoutQuery = (url: string) => url.split(/[?#]/)[0];

/**
 * A report from a browser, checked and trimmed: known fields only, strings cut to size, URLs without
 * their query. Anyone can post here, so nothing is trusted. Returns null for anything that isn't one.
 */
export function parseBrowserReport(input: unknown): BrowserReport | null {
  if (typeof input !== "object" || input === null) return null;
  const body = input as Record<string, unknown>;
  const page = text(body.page, 300);
  if (!page?.startsWith("/")) return null;
  const context: Context = { page: withoutQuery(page), ...(isRequestId(body.requestId) && { requestId: body.requestId }) };

  if (body.type === "error") {
    const message = text(body.message, 1000);
    if (!oneOf(ERROR_KINDS, body.kind) || !message) return null;
    const source = text(body.source, 500);
    return {
      type: "error",
      kind: body.kind,
      message,
      name: text(body.name, 100),
      stack: text(body.stack, 4000),
      source: source && withoutQuery(source),
      line: count(body.line),
      column: count(body.column),
      ...context,
    };
  }

  if (body.type === "vital") {
    const id = text(body.id, 100);
    const { value } = body;
    if (!oneOf(VITALS, body.name) || !oneOf(RATINGS, body.rating) || !id || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return null;
    }
    return { type: "vital", name: body.name, value, rating: body.rating, id, navigationType: text(body.navigationType, 30), ...context };
  }

  return null;
}
