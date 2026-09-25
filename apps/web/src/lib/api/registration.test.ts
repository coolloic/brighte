import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";

vi.mock("server-only", () => ({}));
const graphql = vi.fn();
vi.mock("./client", () => ({ graphql: (...args: unknown[]) => graphql(...args) }));

const { getServiceOptions, registerInterest } = await import("./registration");

const input = { name: "Ada", email: "ada@example.com", mobile: "0412345678", postcode: "2000", services: ["delivery"] };

beforeEach(() => graphql.mockReset());
beforeEach(() => getServiceOptions.clear());

describe("getServiceOptions", () => {
  it("returns only code and label", async () => {
    graphql.mockResolvedValueOnce({ serviceTypes: [{ code: "delivery", label: "Delivery", active: true }] });
    await expect(getServiceOptions()).resolves.toEqual([{ code: "delivery", label: "Delivery" }]);
  });

  it("asks the API once and reuses the answer", async () => {
    graphql.mockResolvedValue({ serviceTypes: [{ code: "delivery", label: "Delivery" }] });
    await getServiceOptions();
    await getServiceOptions();
    expect(graphql).toHaveBeenCalledOnce();
  });

  it("doesn't forward the visitor's IP: the answer is shared by every visitor", async () => {
    graphql.mockResolvedValueOnce({ serviceTypes: [] });
    await getServiceOptions();
    const [, , options] = graphql.mock.calls[0] as [string, object, { requestHeaders?: Headers }];
    expect(options.requestHeaders?.get("x-forwarded-for")).toBeNull();
  });

  it("asks again after a failure", async () => {
    graphql.mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "down"));
    await expect(getServiceOptions()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    graphql.mockResolvedValueOnce({ serviceTypes: [] });
    await expect(getServiceOptions()).resolves.toEqual([]);
  });
});

describe("registerInterest", () => {
  it("sends the values as the mutation's variables", async () => {
    graphql.mockResolvedValueOnce({ register: { id: "1" } });
    await expect(registerInterest(input)).resolves.toEqual({ ok: true });
    expect(graphql).toHaveBeenCalledWith(expect.stringContaining("mutation Register"), input);
  });

  it("returns feedback for the form instead of throwing", async () => {
    graphql.mockRejectedValueOnce(new ApiError("CONFLICT", "Email already registered"));
    await expect(registerInterest(input)).resolves.toEqual({
      ok: false,
      fieldErrors: { email: "This email has already registered interest. Use a different email." },
    });
  });

  it("rethrows bugs that aren't API errors", async () => {
    graphql.mockRejectedValueOnce(new TypeError("boom"));
    await expect(registerInterest(input)).rejects.toThrow("boom");
  });
});
