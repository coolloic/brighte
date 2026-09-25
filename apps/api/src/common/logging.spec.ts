import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestId } from './logging.js';

function idFor(header?: string) {
  const setHeader = vi.fn();
  const req = { headers: header === undefined ? {} : { 'x-request-id': header } } as unknown as IncomingMessage;
  const id = requestId(req, { setHeader } as unknown as ServerResponse);
  expect(setHeader).toHaveBeenCalledWith('x-request-id', id);
  return id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestId', () => {
  it("keeps the caller's id, so a request can be followed across servers", () => {
    expect(idFor('web-0b6f3c2e')).toBe('web-0b6f3c2e');
  });

  it('creates one when there is none', () => {
    expect(idFor()).toMatch(UUID);
  });

  it('replaces an id that could forge log text, or is too short or long to be one', () => {
    for (const bad of ['abc', 'x'.repeat(129), 'ok-id-1234\n{"level":60}', 'has spaces here']) expect(idFor(bad)).toMatch(UUID);
  });
});
