const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key/i;
const EMAIL = /([^@\s]{1,2})[^@\s]*(@[^\s]+)/g;

/** Deep-copies `value`, masking secrets and partially masking emails, for safe logging. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[depth-limit]';
  if (typeof value === 'string') return value.replace(EMAIL, '$1***$2').slice(0, 500);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? '***' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}
