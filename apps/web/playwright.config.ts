import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3001",
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
      url: "http://localhost:4001",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "node_modules/.bin/next build && exec node_modules/.bin/next start --port 3001",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
