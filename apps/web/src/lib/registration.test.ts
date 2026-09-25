import { describe, expect, it } from "vitest";
import { registrationFromFormData, registrationToFormData, validateRegistration } from "./registration";

const values = { name: "Ada", email: "ada@example.com", mobile: "0412 345 678", postcode: "2000", services: ["delivery", "payment"] };

describe("registration form data", () => {
  it("round-trips the values", () => {
    expect(registrationFromFormData(registrationToFormData(values))).toEqual(values);
  });

  it("treats missing fields as empty and drops files", () => {
    const formData = new FormData();
    formData.set("name", new Blob(["x"]));
    formData.append("services", new Blob(["x"]));
    formData.append("services", "pick-up");
    expect(registrationFromFormData(formData)).toEqual({ name: "", email: "", mobile: "", postcode: "", services: ["pick-up"] });
  });
});

describe("validateRegistration (mirrors the API's rules)", () => {
  it("accepts valid values, in the formats the API accepts", () => {
    expect(validateRegistration(values)).toEqual({});
    expect(validateRegistration({ ...values, mobile: "+61412345678" })).toEqual({});
    expect(validateRegistration({ ...values, mobile: "(04) 1234-5678" })).toEqual({});
    expect(validateRegistration({ ...values, email: "  Ada.Lovelace+eats@Example.com.au ", postcode: " 0800 " })).toEqual({});
    // The longest name the API accepts: 70 characters, counted after trimming.
    expect(validateRegistration({ ...values, name: ` ${"x".repeat(70)} ` })).toEqual({});
  });

  it("reports every problem at once, with the API's messages", () => {
    expect(validateRegistration({ name: " ", email: "ada@", mobile: "0212345678", postcode: "200", services: [] })).toEqual({
      name: "Name is required",
      email: "Enter a valid email address",
      mobile: "Enter an Australian mobile number",
      postcode: "Enter a 4-digit postcode",
      services: "Choose at least one service",
    });
  });

  it.each([
    ["name", { name: "x".repeat(71) }, "Name must be 70 characters or fewer"],
    ["email", { email: `${"a".repeat(250)}@example.com` }, "Email is too long"],
    ["email", { email: "ada@example" }, "Enter a valid email address"],
    ["mobile", { mobile: "0412 345 67" }, "Enter an Australian mobile number"],
    ["postcode", { postcode: "20OO" }, "Enter a 4-digit postcode"],
  ] as const)("%s: %j", (field, change, message) => {
    expect(validateRegistration({ ...values, ...change })).toEqual({ [field]: message });
  });
});
