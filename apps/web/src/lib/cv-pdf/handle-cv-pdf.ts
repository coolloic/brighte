import { clientIp } from "../api";
import { parseCoverLetterBlock, parseProfileBlock, parseTailoredBlock, readJson, tailorCv, type CoverLetterBlock, type Profile, type RateLimitResult } from "../chat";
import { printable, unsupportedCharacters } from "./characters";
import type { CvPdfErrorBody } from "./errors";
import { coverLetterFilename, cvFilename } from "./filenames";
import { renderCoverLetterPdf, renderCvPdf } from "./render";

export type CvPdfHandlerDeps = {
  takeRateLimit: (key: string) => RateLimitResult;
  /** Proxies whose X-Forwarded-For entries are trusted (WEB_TRUST_PROXY). */
  trustedHops: number;
  render?: (cv: Profile) => Promise<Buffer>;
  renderCoverLetter?: (basics: Profile["basics"], letter: CoverLetterBlock, date: string) => Promise<Buffer>;
  /** For tests: when the letter is dated. */
  now?: () => Date;
};

/** The day a cover letter is printed, as an Australian letter writes it: "9 October 2026". */
const letterDate = (now: Date) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" }).format(now);

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Content-Disposition for a download. Header values must be Latin-1 bytes, so a name with other
 * characters gets an ASCII fallback plus the exact name as UTF-8 (filename*, RFC 6266).
 */
function attachment(filename: string) {
  if (/^[\x20-\x7e]+$/.test(filename)) return `attachment; filename="${filename}"`;
  const fallback = filename.replace(/[^\x20-\x7e]/g, "-");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const error = (status: number, body: CvPdfErrorBody, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/**
 * POST /api/cv-pdf: `{ profile, tailored? }` or `{ profile, coverLetter }` as the blocks' JSON from
 * the chat. A cover letter's letterhead (name, contact details) comes from the profile. The server checks
 * again what the browser sends: both schemas, and for a tailored CV, tailorCv on that pair (409 on
 * blocking flags). That catches page bugs and stale state. It can't stop the CV's own owner from
 * sending any profile they like (they can also correct their profile in the chat to say anything);
 * the never-invent rule is about the model, and that is enforced in the chat.
 */
export async function handleCvPdf(request: Request, deps: CvPdfHandlerDeps): Promise<Response> {
  // JSON only: a cross-site page can't send that without a CORS preflight, which this route never allows.
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error(415, { code: "BAD_REQUEST" });
  // Read as it arrives and stop at the limit: a body without (or with a false) content-length can't
  // make the server hold more than that.
  const read = await readJson(request, MAX_BODY_BYTES);
  if (read === "too-large") return error(413, { code: "TOO_LARGE" });
  if (read === "invalid") return error(400, { code: "BAD_REQUEST" });
  const body = read.json as { profile?: unknown; tailored?: unknown; coverLetter?: unknown } | null;
  const profile = body && typeof body === "object" ? parseProfileBlock(JSON.stringify(body.profile ?? null)) : undefined;
  const tailored = body?.tailored === undefined ? undefined : parseTailoredBlock(JSON.stringify(body.tailored));
  const coverLetter = body?.coverLetter === undefined ? undefined : parseCoverLetterBlock(JSON.stringify(body.coverLetter));
  if (!profile || (body?.tailored !== undefined && !tailored) || (body?.coverLetter !== undefined && !coverLetter) || (tailored && coverLetter)) {
    return error(400, { code: "BAD_REQUEST" });
  }

  const visitor = clientIp(request.headers.get("x-forwarded-for"), deps.trustedHops) ?? "unknown";
  const limit = deps.takeRateLimit(visitor);
  if (!limit.ok) {
    return error(429, { code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { "retry-after": String(limit.retryAfterSeconds) });
  }

  if (coverLetter) return coverLetterPdf(printable(profile.basics), printable(coverLetter), deps);

  let cv = profile;
  if (tailored) {
    const result = tailorCv(profile, tailored);
    if (result.flags.some((flag) => flag.level === "blocking")) return error(409, { code: "HAS_BLOCKING_FLAGS" });
    cv = result.cv;
  }
  cv = printable(cv);
  const unsupported = unsupportedCharacters(cv);
  if (unsupported.length > 0) return error(422, { code: "UNSUPPORTED_CHARACTERS", characters: unsupported.slice(0, 10) });

  let pdf: Buffer;
  try {
    pdf = await (deps.render ?? renderCvPdf)(cv);
  } catch (cause) {
    console.error("Rendering a CV PDF failed:", cause);
    return error(500, { code: "RENDER_FAILED" });
  }
  return pdfResponse(pdf, cvFilename(cv, tailored?.job));
}

async function coverLetterPdf(basics: Profile["basics"], letter: CoverLetterBlock, deps: CvPdfHandlerDeps): Promise<Response> {
  const unsupported = unsupportedCharacters({ basics, letter });
  if (unsupported.length > 0) return error(422, { code: "UNSUPPORTED_CHARACTERS", characters: unsupported.slice(0, 10) });
  let pdf: Buffer;
  try {
    pdf = await (deps.renderCoverLetter ?? renderCoverLetterPdf)(basics, letter, letterDate((deps.now ?? (() => new Date()))()));
  } catch (cause) {
    console.error("Rendering a cover letter PDF failed:", cause);
    return error(500, { code: "RENDER_FAILED" });
  }
  return pdfResponse(pdf, coverLetterFilename(basics, letter.job));
}

function pdfResponse(pdf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": attachment(filename), "cache-control": "no-store" },
  });
}
