export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Fixed-window counter per key (a visitor's IP): `limit` hits per `windowMs`. In memory, per
 * server instance: with several instances each counts on its own, so the real limit is `limit`
 * times the instance count. Expired keys are swept once the map grows, so it stays bounded.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return function take(key: string): RateLimitResult {
    const time = now();
    if (windows.size >= 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= time) windows.delete(k);
    }
    let window = windows.get(key);
    if (!window || window.resetAt <= time) {
      window = { count: 0, resetAt: time + windowMs };
      windows.set(key, window);
    }
    if (window.count >= limit) return { ok: false, retryAfterSeconds: Math.ceil((window.resetAt - time) / 1000) };
    window.count += 1;
    return { ok: true };
  };
}
