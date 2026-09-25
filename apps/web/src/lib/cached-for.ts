/**
 * Memoises a no-argument async function for `ttlMs`. Callers that arrive while it loads share that
 * load. Only successes are kept: a failure reaches its callers, and the next call tries again. In
 * memory, per server instance: for small data that rarely changes (the service types).
 */
export function cachedFor<T>(ttlMs: number, load: () => Promise<T>, now: () => number = Date.now) {
  let entry: { value: Promise<T>; expires: number } | undefined;

  const get = () => {
    if (entry && entry.expires > now()) return entry.value;
    const value = load();
    const current = { value, expires: now() + ttlMs };
    entry = current;
    value.catch(() => {
      if (entry === current) entry = undefined;
    });
    return value;
  };

  return Object.assign(get, {
    /** Forgets the kept result (tests). */
    clear: () => {
      entry = undefined;
    },
  });
}
