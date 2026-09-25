import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Ports come from the root .env (see .env.example), falling back to the defaults.
const rootEnv = path.join(__dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
// The API's .env holds the seed accounts' passwords (pnpm db:seed), used by the admin sign-in tests.
const apiEnv = path.join(__dirname, "../api/.env");
if (existsSync(apiEnv)) process.loadEnvFile(apiEnv);
// The suite starts its own production API and web servers, 100 above the dev ports, so it never
// runs against (or disturbs) a dev setup. They trust X-Forwarded-For (TRUST_PROXY on the API,
// WEB_TRUST_PROXY on the web), and each test sends its own visitor IP: tests don't share a rate
// limit, and the whole forwarding chain is tested.
const webPort = Number(process.env.WEB_PORT ?? 3001) + 100;
const apiPort = Number(process.env.API_PORT ?? 4001) + 100;
// A second web server on the same build whose API can't be reached (nothing listens on port 9), for
// e2e/api-down.spec.ts. Set here so the test workers inherit it.
const apiDownWebPort = webPort + 1;
process.env.E2E_API_DOWN_URL = `http://localhost:${apiDownWebPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: "on-first-retry",
  },
  // Mobile-first: mobile viewport is the primary project.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Call binaries directly (not via pnpm) and `exec` so Playwright can stop the servers on teardown.
      command: "cd ../api && node_modules/.bin/nest build && exec node --env-file-if-exists=.env dist/main.js",
      url: `http://localhost:${apiPort}`,
      env: { ...process.env, PORT: String(apiPort), TRUST_PROXY: "1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node_modules/.bin/next build && exec node_modules/.bin/next start --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      env: { ...process.env, API_URL: `http://localhost:${apiPort}/graphql`, WEB_TRUST_PROXY: "1" },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Servers start in order, so the build above already exists.
      command: `exec node_modules/.bin/next start --port ${apiDownWebPort}`,
      url: `http://localhost:${apiDownWebPort}`,
      env: { ...process.env, API_URL: "http://localhost:9/graphql" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
