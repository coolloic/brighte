import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Ports come from the root .env (see .env.example), falling back to the defaults.
const rootEnv = path.join(__dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const webPort = process.env.WEB_PORT ?? "3001";
const apiPort = process.env.API_PORT ?? "4001";

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
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `node_modules/.bin/next build && exec node_modules/.bin/next start --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
