import { z } from 'zod';
import { MyDataKind } from './dto/my-data.js';
import { emailSchema, saveMyDataSchema, searchMyDataSchema } from './my-data.schemas.js';

const valid = { email: ' Jane@Example.com ', kind: MyDataKind.PROFILE, title: 'Jane Citizen', content: '{"basics":{"name":"Jane"}}', chunks: ['Jane Citizen, Front-end Engineer'] };
const fields = (result: z.ZodSafeParseResult<unknown>) => (result.success ? [] : result.error.issues.map((issue) => issue.path.join('.')));

describe('saveMyDataSchema', () => {
  it('accepts a document and lowercases the email', () => {
    expect(saveMyDataSchema.parse(valid).email).toBe('jane@example.com');
  });

  it.each([
    ['an invalid email', { email: 'jane' }, 'email'],
    ['a blank title', { title: ' ' }, 'title'],
    ['content that is not JSON', { content: '{' }, 'content'],
    ['content that is a JSON array', { content: '[]' }, 'content'],
    ['content over 64 KB', { content: JSON.stringify({ x: 'x'.repeat(70_000) }) }, 'content'],
    ['no chunks', { chunks: [] }, 'chunks'],
    ['too many chunks', { chunks: Array.from({ length: 81 }, () => 'text') }, 'chunks'],
    ['a chunk over 2,000 characters', { chunks: ['x'.repeat(2001)] }, 'chunks.0'],
    ['an unknown kind', { kind: 'notes' }, 'kind'],
  ])('rejects %s', (_, override, field) => {
    expect(fields(saveMyDataSchema.safeParse({ ...valid, ...override }))).toContain(field);
  });
});

describe('searchMyDataSchema', () => {
  it.each([
    ['an empty query', { query: ' ' }, 'query'],
    ['a query over 2,000 characters', { query: 'x'.repeat(2001) }, 'query'],
    ['a limit of 0', { limit: 0 }, 'limit'],
    ['a limit over 20', { limit: 21 }, 'limit'],
  ])('rejects %s', (_, override, field) => {
    expect(fields(searchMyDataSchema.safeParse({ email: 'jane@example.com', query: 'react', limit: 6, ...override }))).toContain(field);
  });
});

describe('emailSchema', () => {
  it('lowercases and trims', () => {
    expect(emailSchema.parse({ email: ' JANE@example.COM' }).email).toBe('jane@example.com');
  });
});
