/**
 * The web app's public address: SITE_URL in production (e.g. https://eats.brighte.com.au),
 * otherwise http://localhost:$WEB_PORT. Used for canonical links, the sitemap and social sharing.
 */
export function siteUrl(): URL {
  return new URL(process.env.SITE_URL || `http://localhost:${process.env.WEB_PORT ?? 3001}`);
}
