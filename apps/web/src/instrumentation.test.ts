import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./lib/api/errors";

vi.mock("server-only", () => ({}));
const { onRequestError } = await import("./instrumentation");

afterEach(() => vi.restoreAllMocks());

describe("onRequestError", () => {
  it("logs the digest the error page shows, with the request and the API call's id", async () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new ApiError("NETWORK_ERROR", "Could not reach the API", { requestId: "req-12345678" }), { digest: "2785329176" });

    await onRequestError(
      error,
      { path: "/admin?q=ada", method: "GET", headers: { "x-request-id": "req-12345678" } },
      { routerKind: "App Router", routePath: "/admin", routeType: "render", renderSource: "server-rendering", revalidateReason: undefined },
    );

    expect(JSON.parse(write.mock.calls[0][0] as string)).toMatchObject({
      level: 50,
      msg: "Request failed",
      digest: "2785329176",
      requestId: "req-12345678",
      code: "NETWORK_ERROR",
      method: "GET",
      path: "/admin?q=ada",
      routePath: "/admin",
      routeType: "render",
      err: { type: "ApiError", message: "Could not reach the API" },
    });
  });
});
