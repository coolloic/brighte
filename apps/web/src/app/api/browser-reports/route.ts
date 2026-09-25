import { clientIp } from "@/lib/api/client-ip";
import { MAX_REPORT_BYTES, parseBrowserReport } from "@/lib/browser-reports";
import { log } from "@/lib/log";
import { FixedWindowLimiter } from "@/lib/rate-limit";

/** A page load sends about five Web Vitals and rarely an error; this leaves room for a few pages a minute. */
const REPORTS_PER_MINUTE = 60;
const limiter = new FixedWindowLimiter(REPORTS_PER_MINUTE, 60_000);

/**
 * Receives the browser's reports (src/instrumentation-client.ts, app/_components/WebVitals.tsx) and
 * writes each as a log line, next to the server's own: "Browser error" at warn, "Web vital" at info.
 * Public, so it is limited per visitor IP, refuses large bodies unread, and keeps only known fields.
 * Answers 204 with no body; the sender never reads it.
 */
export async function POST(request: Request) {
  // Without a trusted proxy (local development) visitors can't be told apart, and share one limit.
  const ip = clientIp(request.headers.get("x-forwarded-for"), Number(process.env.WEB_TRUST_PROXY ?? 0)) ?? "unknown";
  if (!limiter.allow(ip)) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });

  const body = await readText(request, MAX_REPORT_BYTES);
  if (body === null) return new Response(null, { status: 413 });
  let report;
  try {
    report = parseBrowserReport(JSON.parse(body));
  } catch {
    report = null;
  }
  if (!report) return new Response(null, { status: 400 });

  const { page, requestId } = report;
  const userAgent = request.headers.get("user-agent")?.slice(0, 200);
  if (report.type === "error") {
    const { kind, name, message, stack, source, line, column } = report;
    log.warn("Browser error", { kind, err: { type: name ?? "Error", message, stack }, source, line, column, page, requestId, userAgent });
  } else {
    const { name, value, rating, id, navigationType } = report;
    log.info("Web vital", { name, value, rating, id, navigationType, page, requestId, userAgent });
  }
  return new Response(null, { status: 204 });
}

/** The body as text, or null once it passes `maxBytes`: a client that lies about Content-Length or sends it chunked still can't make the server buffer more. */
async function readText(request: Request, maxBytes: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
