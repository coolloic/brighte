/**
 * The visitor's IP, read from the X-Forwarded-For header that `trustedHops` proxies in front of
 * this server appended (a load balancer, a hosting platform). Each proxy appends the address it
 * received the request from, so the visitor is `trustedHops` entries from the right. Entries
 * further left were sent by the client and can be anything, so they are never used.
 *
 * With no trusted proxies (local development), there is nothing to trust: returns undefined.
 */
export function clientIp(forwardedFor: string | null, trustedHops: number): string | undefined {
  if (!forwardedFor || !Number.isInteger(trustedHops) || trustedHops < 1) return undefined;
  const hops = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return hops.at(-trustedHops);
}
