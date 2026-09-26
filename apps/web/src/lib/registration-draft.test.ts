import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRegistrationDraft, readRegistrationDraft, saveRegistrationDraft } from "./registration-draft";

const values = { name: "Ada", email: "ada@example.com", mobile: "0412 345 678", postcode: "2000", services: ["delivery"] };

/** A minimal in-memory sessionStorage (the unit tests run in Node). */
function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

describe("registration draft", () => {
  beforeEach(() => vi.stubGlobal("sessionStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("saves, reads back and clears the values", () => {
    expect(readRegistrationDraft()).toBeUndefined();
    saveRegistrationDraft(values);
    expect(readRegistrationDraft()).toEqual(values);
    clearRegistrationDraft();
    expect(readRegistrationDraft()).toBeUndefined();
  });

  it("ignores anything that isn't a draft", () => {
    for (const saved of ["not json", "42", JSON.stringify({ ...values, services: "delivery" }), JSON.stringify({ name: "Ada" })]) {
      sessionStorage.setItem("brighte:registration-draft", saved);
      expect(readRegistrationDraft()).toBeUndefined();
    }
  });

  it("does nothing, without throwing, when storage is unavailable", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => saveRegistrationDraft(values)).not.toThrow();
    expect(readRegistrationDraft()).toBeUndefined();
    expect(() => clearRegistrationDraft()).not.toThrow();
  });
});
