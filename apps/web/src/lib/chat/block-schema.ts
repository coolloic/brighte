import { z } from "zod";

// Shared by the component blocks' schemas (profile, tailored): trimmed strings, optional fields where
// null counts as left out, capped lists, and parsing that treats blank strings as left out.

export const text = (max: number) => z.string().trim().max(max);
export const required = (max: number) => text(max).min(1);
/** Optional; null (which models often write for "none") counts as left out. */
export const optional = <T extends z.ZodType>(schema: T) =>
  schema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional();
export const list = <T extends z.ZodType>(item: T, max: number) => optional(z.array(item).max(max));
export const strings = (maxLength: number, maxItems: number) => list(required(maxLength), maxItems);

/**
 * The JSON with blank strings removed (as values and as list items): models write "" for "unknown",
 * which should leave a field out, not fail the block. Done before parsing, not in the schema, so the
 * JSON Schema the model is taught stays exact.
 */
function withoutBlanks(value: unknown): unknown {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (Array.isArray(value)) return value.map(withoutBlanks).filter((item) => item !== undefined);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutBlanks(item)]));
  return value;
}

/** A block's JSON, checked. Undefined when it isn't valid, or isn't complete yet while streaming. */
export function parseJsonBlock<T>(code: string, schema: z.ZodType<T>): T | undefined {
  let json: unknown;
  try {
    json = JSON.parse(code);
  } catch {
    return undefined;
  }
  const result = schema.safeParse(withoutBlanks(json));
  return result.success ? result.data : undefined;
}
