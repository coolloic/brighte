import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Built on each request, so SITE_URL is read at runtime like the pages (one build for every environment).
export const dynamic = "force-dynamic";

/** /sitemap.xml: the public pages. Admin pages are private (noindex) and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/", siteUrl()).href, changeFrequency: "monthly", priority: 1 }];
}
