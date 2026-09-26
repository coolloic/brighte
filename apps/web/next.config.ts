import path from "node:path";
import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // No "X-Powered-By: Next.js": don't advertise the framework.
  poweredByHeader: false,
  // Container images (apps/web/Dockerfile) build with NEXT_OUTPUT=standalone: a self-contained
  // server.js with only the files it needs, traced from the repo root so workspace packages are
  // included. Left unset, `next start` works as usual (dev, e2e, Lighthouse).
  ...(process.env.NEXT_OUTPUT === "standalone" && {
    output: "standalone" as const,
    outputFileTracingRoot: path.join(process.cwd(), "../.."),
  }),
  // The CSP (with its per-request nonce) and HSTS are set in src/proxy.ts.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
