import { z } from 'zod';
import { MyDataKind } from './dto/my-data.js';

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_BYTES = 64 * 1024;
export const MAX_CHUNKS = 80;
export const MAX_CHUNK_LENGTH = 2000;
export const MAX_QUERY_LENGTH = 2000;
export const MAX_MATCHES = 20;

const email = z.string().trim().toLowerCase().pipe(z.email('email must be a valid email address'));

/** A JSON object, at most MAX_CONTENT_BYTES, kept as the string it came as. */
const content = z
  .string()
  .refine((text) => Buffer.byteLength(text) <= MAX_CONTENT_BYTES, `content must be at most ${MAX_CONTENT_BYTES / 1024} KB`)
  .refine((text) => {
    try {
      const value: unknown = JSON.parse(text);
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    } catch {
      return false;
    }
  }, 'content must be a JSON object');

export const saveMyDataSchema = z.object({
  email,
  kind: z.enum(MyDataKind),
  title: z.string().trim().min(1, 'title is required').max(MAX_TITLE_LENGTH, `title must be at most ${MAX_TITLE_LENGTH} characters`),
  content,
  chunks: z
    .array(z.string().trim().min(1, 'chunks must not be blank').max(MAX_CHUNK_LENGTH, `each chunk must be at most ${MAX_CHUNK_LENGTH} characters`))
    .min(1, 'chunks must have at least one item')
    .max(MAX_CHUNKS, `chunks must have at most ${MAX_CHUNKS} items`),
});
export type SaveMyDataInput = z.output<typeof saveMyDataSchema>;

export const emailSchema = z.object({ email });

export const searchMyDataSchema = z.object({
  email,
  query: z.string().trim().min(1, 'query is required').max(MAX_QUERY_LENGTH, `query must be at most ${MAX_QUERY_LENGTH} characters`),
  limit: z.int().min(1, 'limit must be at least 1').max(MAX_MATCHES, `limit must be at most ${MAX_MATCHES}`),
});
