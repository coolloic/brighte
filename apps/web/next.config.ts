import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // No "X-Powered-By: Next.js": don't advertise the framework.
  poweredByHeader: false,
  // The CSP (with its per-request nonce) and HSTS are set in src/proxy.ts.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
