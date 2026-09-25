// Security headers for every page. The Content-Security-Policy carries a per-request nonce, so it
// is set by src/proxy.ts; the headers that never change are in next.config.ts.

type PolicyOptions = {
  /** Fresh for every request: only scripts and styles carrying it may run. */
  nonce: string;
  /** `next dev`: React needs eval for its error overlay, and dev CSS is injected inline. */
  development: boolean;
  /** The site is served over HTTPS (SITE_URL): upgrade any http:// subresource. */
  https: boolean;
};

/**
 * A strict CSP (Next's recommended nonce policy): scripts only from this site with the nonce (and
 * what they load, 'strict-dynamic'), no plugins, no framing by other sites, forms only to this
 * site. The API is never called from the browser, so connections stay same-origin.
 */
export function contentSecurityPolicy({ nonce, development, https }: PolicyOptions): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only on HTTPS: on http://localhost it would upgrade the site's own requests and break them.
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** HSTS: browsers only use HTTPS for this site for two years. Only sent over HTTPS (browsers ignore it otherwise). */
export const STRICT_TRANSPORT_SECURITY = "max-age=63072000; includeSubDomains";

/** Headers that are the same for every response (next.config.ts). */
export const STATIC_SECURITY_HEADERS = [
  // Don't guess content types: a file served as text isn't run as a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our origin, never full URLs (which carry ?q= searches and lead ids).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these browser features.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // For older browsers without CSP frame-ancestors: never show the site in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
];
