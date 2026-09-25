import "server-only";
import type { ApiError } from "./api/errors";

// pino's numeric levels, so the web server's lines read like the API's (level >= 40 finds both).
const LEVELS = { info: 30, warn: 40, error: 50 } as const;
type Level = keyof typeof LEVELS;

/**
 * Writes one JSON object per line: the same shape as the API's logs (`level`, `time`, `msg`, then
 * fields), so one collector and one query cover both. Pass `requestId` whenever there is one: it is
 * the id the API logged the call under (`reqId` there). Never pass passwords, tokens or form values.
 */
function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level: LEVELS[level], time: Date.now(), context: "web", msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};

/**
 * An error as log fields: `err` with its type, message and stack, like pino's. For an ApiError, also
 * its `code` and `requestId`, the id the API logged the call under. Read from the fields rather than
 * `instanceof`: instrumentation.ts is bundled apart from the pages, with its own copy of ApiError.
 */
export function errorFields(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { err: { type: typeof error, message: String(error) } };
  const { code, requestId } = error as Partial<Pick<ApiError, "code" | "requestId">>;
  return {
    err: { type: error.name, message: error.message, stack: error.stack },
    ...(code && { code }),
    ...(requestId && { requestId }),
  };
}
