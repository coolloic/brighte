import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api/errors";

vi.mock("server-only", () => ({}));
const { errorFields, log } = await import("./log");

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("writes one JSON line with pino's level numbers, like the API", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    log.info("Hello", { requestId: "req-12345678" });
    log.error("Broken");

    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      level: 30,
      time: expect.any(Number) as number,
      context: "web",
      msg: "Hello",
      requestId: "req-12345678",
    });
    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({ level: 50, msg: "Broken" });
  });
});

describe("errorFields", () => {
  it("gives an ApiError's code and the id the API logged the call under", () => {
    const fields = errorFields(new ApiError("NETWORK_ERROR", "Could not reach the API", { requestId: "req-12345678" }));
    expect(fields).toMatchObject({
      err: { type: "ApiError", message: "Could not reach the API", stack: expect.any(String) as string },
      code: "NETWORK_ERROR",
      requestId: "req-12345678",
    });
  });

  it("reads them from the fields, since instrumentation.ts has its own copy of ApiError", () => {
    const copy = Object.assign(new Error("Could not reach the API"), { name: "ApiError", code: "NETWORK_ERROR", requestId: "req-12345678" });
    expect(errorFields(copy)).toMatchObject({ code: "NETWORK_ERROR", requestId: "req-12345678" });
  });

  it("describes anything else that was thrown", () => {
    expect(errorFields(new TypeError("x is undefined"))).toEqual({ err: expect.objectContaining({ type: "TypeError", message: "x is undefined" }) as object });
    expect(errorFields("oops")).toEqual({ err: { type: "string", message: "oops" } });
  });
});
