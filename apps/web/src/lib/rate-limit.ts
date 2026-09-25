/** Above this many keys, a request also clears every key whose window has ended. */
const MAX_KEYS = 10_000;

/**
 * At most `limit` calls per key (e.g. a visitor IP) in each window of `windowMs`. In memory, so each
 * web server instance counts separately.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Counts a call for `key`; false once the key is over its limit for the current window. */
  allow(key: string): boolean {
    const now = this.now();
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      if (this.windows.size >= MAX_KEYS) this.forgetEnded(now);
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.limit;
  }

  private forgetEnded(now: number) {
    for (const [key, window] of this.windows) if (now - window.start >= this.windowMs) this.windows.delete(key);
  }
}
