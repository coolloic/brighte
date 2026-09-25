import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Built on each request, so SITE_URL is read at runtime like the pages (one build for every environment).
export const dynamic = "force-dynamic";

/**
 * /robots.txt: everything may be crawled, and the sitemap lists the public page. /admin is not
 * disallowed here on purpose: its pages say noindex, and a crawler blocked by robots.txt would
 * never see that (a blocked URL can still be indexed from links, without its content).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
