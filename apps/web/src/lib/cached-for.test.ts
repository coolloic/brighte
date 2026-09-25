import { describe, expect, it, vi } from "vitest";
import { cachedFor } from "./cached-for";

describe("cachedFor", () => {
  it("keeps a result for the given time, then loads again", async () => {
    let now = 0;
    const load = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const get = cachedFor(1000, load, () => now);

    await expect(get()).resolves.toBe("first");
    now = 999;
    await expect(get()).resolves.toBe("first");
    now = 1000;
    await expect(get()).resolves.toBe("second");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between callers that arrive together", async () => {
    const load = vi.fn().mockResolvedValue("value");
    const get = cachedFor(1000, load);
    await expect(Promise.all([get(), get(), get()])).resolves.toEqual(["value", "value", "value"]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("never keeps a failure: the next call tries again", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("value");
    const get = cachedFor(1000, load);
    await expect(get()).rejects.toThrow("down");
    await expect(get()).resolves.toBe("value");
  });

  it("clear() forgets the result", async () => {
    const load = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const get = cachedFor(1000, load);
    await get();
    get.clear();
    await expect(get()).resolves.toBe("second");
  });
});
