import { describe, expect, it } from "vitest";
import { registrationFromFormData, registrationToFormData } from "./registration";

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
