import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";

vi.mock("server-only", () => ({}));
const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

const { graphql } = await import("./client");

const fetchMock = vi.fn<typeof fetch>();
const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as unknown };
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_URL", "http://api.test/graphql");
  vi.stubEnv("WEB_TRUST_PROXY", "");
  requestHeaders.delete("x-forwarded-for");
  requestHeaders.delete("x-request-id");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("graphql", () => {
  it("posts the operation and returns data", async () => {
    respond({ data: { serviceTypes: [] } });
    await expect(graphql("query { serviceTypes { code } }", { a: 1 })).resolves.toEqual({ serviceTypes: [] });
    const { url, headers, body } = sent();
    expect(url).toBe("http://api.test/graphql");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("authorization")).toBe(false);
    expect(body).toEqual({ query: "query { serviceTypes { code } }", variables: { a: 1 } });
  });

  it("sends the token as a bearer header", async () => {
    respond({ data: { me: { id: "1" } } });
    await graphql("query { me { id } }", {}, { token: "abc" });
    expect(sent().headers.get("authorization")).toBe("Bearer abc");
  });

  it("forwards the visitor's IP only when a proxy is trusted", async () => {
    requestHeaders.set("x-forwarded-for", "6.6.6.6, 203.0.113.7");
    respond({ data: {} });
    await graphql("query { a }");
    expect(sent().headers.has("x-forwarded-for")).toBe(false);

    fetchMock.mockReset();
    vi.stubEnv("WEB_TRUST_PROXY", "1");
    respond({ data: {} });
    await graphql("query { a }");
    expect(sent().headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("throws the API's error code, field messages and retryAfter", async () => {
    respond({
      data: null,
      errors: [{ message: "Invalid input", extensions: { code: "BAD_USER_INPUT", fields: { postcode: "Enter a 4-digit postcode" } } }],
    });
    await expect(graphql("mutation { register }")).rejects.toMatchObject({
      name: "ApiError",
      code: "BAD_USER_INPUT",
      fields: { postcode: "Enter a 4-digit postcode" },
    });
  });

  it("sends the page request's id, so the API logs the call under it", async () => {
    requestHeaders.set("x-request-id", "page-req-1234");
    respond({ data: {} });
    await graphql("query { a }");
    expect(sent().headers.get("x-request-id")).toBe("page-req-1234");
  });

  it("gives a request without an id its own, and puts the id on the ApiError", async () => {
    respond({ data: null, errors: [{ message: "Nope", extensions: { code: "FORBIDDEN" } }] });
    const error = (await graphql("query { a }").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("FORBIDDEN");
    expect(error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent().headers.get("x-request-id")).toBe(error.requestId);

    fetchMock.mockReset();
    requestHeaders.set("x-request-id", "page-req-1234");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(graphql("query { a }")).rejects.toMatchObject({ code: "NETWORK_ERROR", requestId: "page-req-1234" });
  });

  it("reports an unreachable API as NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(graphql("query { a }")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("reports a response without JSON or without data as INTERNAL_SERVER_ERROR", async () => {
    respond("<html>Bad gateway</html>", 502);
    await expect(graphql("query { a }")).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("502") });
    respond({});
    await expect(graphql("query { a }")).rejects.toBeInstanceOf(ApiError);
  });
});
