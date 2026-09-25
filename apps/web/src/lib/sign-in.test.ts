import { describe, expect, it } from "vitest";
import { safeNext, signInFromFormData, signInToFormData, validateSignIn } from "./sign-in";

describe("sign-in helpers", () => {
  it("round-trips the form values", () => {
    const values = { email: "admin@brighte.dev", password: "p@ss word" };
    expect(signInFromFormData(signInToFormData(values))).toEqual(values);
  });

  it("validates the email format and a password", () => {
    expect(validateSignIn({ email: " admin@brighte.dev ", password: "x" })).toEqual({});
    expect(validateSignIn({ email: "admin@", password: "" })).toEqual({ email: "Enter a valid email address", password: "Enter your password" });
  });

  it.each([
    ["/admin", "/admin"],
    ["/admin?lead=1&page=2", "/admin?lead=1&page=2"],
    ["/admin/leads", "/admin/leads"],
    ["https://evil.example", "/admin"],
    ["//evil.example/admin", "/admin"],
    ["/\\evil.example", "/admin"],
    ["/admin\\@evil.example", "/admin"],
    ["/administrator", "/admin"],
    ["/", "/admin"],
    [undefined, "/admin"],
  ])("safeNext(%j) → %s", (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});
