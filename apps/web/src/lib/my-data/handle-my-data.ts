import { ApiError } from "../api";
import { parseCoverLetterBlock, parseProfileBlock, parseTailoredBlock, readJson, tailorCv } from "../chat";
import { coverLetterChunks, jobTitle, profileChunks, tailoredChunks } from "./chunks";
import { normaliseEmail } from "./email";
import type { MyDataErrorBody } from "./errors";

export type MyDataSaver = (input: { email: string; kind: "PROFILE" | "TAILORED_CV" | "COVER_LETTER"; title: string; content: unknown; chunks: string[] }) => Promise<unknown>;

export type MyDataHandlerDeps = {
  /** MY_DATA=on: off, the route answers 404. */
  enabled: boolean;
  save: MyDataSaver;
};

const MAX_BODY_BYTES = 256 * 1024;

const error = (status: number, body: MyDataErrorBody) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * POST /api/my-data: saves a card from the chat to "My data", under the profile's email. The body is
 * what the card's PDF buttons send: `{ profile }`, `{ profile, tailored }` or `{ profile, coverLetter }`
 * as the blocks' JSON. Checked again here (schemas; a tailored CV with blocking flags is refused), then
 * chunked for search and sent to the API, which embeds and stores it.
 */
export async function handleMyData(request: Request, deps: MyDataHandlerDeps): Promise<Response> {
  if (!deps.enabled) return error(404, { code: "OFF" });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error(415, { code: "BAD_REQUEST" });
  const read = await readJson(request, MAX_BODY_BYTES);
  if (read === "too-large" || read === "invalid") return error(read === "too-large" ? 413 : 400, { code: "BAD_REQUEST" });

  const body = read.json as { profile?: unknown; tailored?: unknown; coverLetter?: unknown } | null;
  const profile = body && typeof body === "object" ? parseProfileBlock(JSON.stringify(body.profile ?? null)) : undefined;
  const tailored = body?.tailored === undefined ? undefined : parseTailoredBlock(JSON.stringify(body.tailored));
  const coverLetter = body?.coverLetter === undefined ? undefined : parseCoverLetterBlock(JSON.stringify(body.coverLetter));
  if (!profile || (body?.tailored !== undefined && !tailored) || (body?.coverLetter !== undefined && !coverLetter) || (tailored && coverLetter)) {
    return error(400, { code: "BAD_REQUEST" });
  }
  if (!profile.basics.email) return error(422, { code: "NO_EMAIL" });
  const email = normaliseEmail(profile.basics.email);

  let input: Parameters<MyDataSaver>[0];
  if (tailored) {
    const result = tailorCv(profile, tailored);
    if (result.flags.some((flag) => flag.level === "blocking")) return error(409, { code: "HAS_BLOCKING_FLAGS" });
    input = { email, kind: "TAILORED_CV", title: jobTitle(tailored.job), content: tailored, chunks: tailoredChunks(tailored.job, result.cv) };
  } else if (coverLetter) {
    input = { email, kind: "COVER_LETTER", title: jobTitle(coverLetter.job), content: coverLetter, chunks: coverLetterChunks(coverLetter) };
  } else {
    input = { email, kind: "PROFILE", title: profile.basics.name, content: profile, chunks: profileChunks(profile) };
  }

  try {
    await deps.save(input);
  } catch (cause) {
    if (!(cause instanceof ApiError)) throw cause;
    console.error("Saving to my data failed:", cause.code, cause.message);
    // FORBIDDEN: the API runs without MY_DATA=on while the web has it on.
    return error(cause.code === "FORBIDDEN" ? 404 : 503, { code: cause.code === "FORBIDDEN" ? "OFF" : "UNAVAILABLE" });
  }
  return Response.json({ email, kind: input.kind, title: input.title }, { headers: { "cache-control": "no-store" } });
}
