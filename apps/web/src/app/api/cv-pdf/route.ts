import { chatConfig, createRateLimiter } from "@/lib/chat/server";
import { handleCvPdf } from "@/lib/cv-pdf/server";

// Settings are read once, when the server starts (root .env).
const config = chatConfig();
const takeRateLimit = createRateLimiter({ limit: config.pdfRateLimit, windowMs: config.rateLimitWindowSeconds * 1000 });

/** A CV (the profile, or a tailored CV checked again here) as a PDF download. */
export function POST(request: Request) {
  return handleCvPdf(request, { takeRateLimit, trustedHops: Number(process.env.WEB_TRUST_PROXY ?? 0) });
}
