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
// A mock Anthropic API (e2e/mock-llm.mjs) for the chat tests: no real model is ever called.
const mockLlmPort = webPort + 2;
// The chat tests expect the chat's default settings (src/lib/chat/config.ts): the persona, models
// and limits. Any CHAT_* setting the root .env holds for local use is blanked for the web servers
// (blank means default), so a local tweak (e.g. CHAT_PERSONA=general) can't fail the suite.
// Blanked, not left out: Playwright starts web servers with its own environment merged in.
const chatDefaults = Object.fromEntries(Object.keys(process.env).filter((key) => key.startsWith("CHAT_")).map((key) => [key, ""]));
// The e2e API itself, for tests that create data directly (e2e/support.ts).
process.env.E2E_API_URL = `http://localhost:${apiPort}/graphql`;

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
      command: `exec node e2e/mock-llm.mjs`,
      url: `http://localhost:${mockLlmPort}/health`,
      env: { ...process.env, PORT: String(mockLlmPort) },
      reuseExistingServer: false,
    },
    {
      // Call binaries directly (not via pnpm) and `exec` so Playwright can stop the servers on teardown.
      command: "cd ../api && node_modules/.bin/nest build && exec node --env-file-if-exists=.env dist/main.js",
      url: `http://localhost:${apiPort}`,
      // 9-minute tokens are always inside the web's 10-minute renewal window, so admin requests
      // exercise session renewal (e2e/admin-session.spec.ts).
      // My data on, with the instant fake embedder: tests never download the model.
      env: { ...process.env, PORT: String(apiPort), TRUST_PROXY: "1", JWT_EXPIRES_IN: "9m", MY_DATA: "on", EMBEDDINGS: "fake" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node_modules/.bin/next build && exec node_modules/.bin/next start --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      env: {
        ...process.env,
        ...chatDefaults,
        API_URL: `http://localhost:${apiPort}/graphql`,
        WEB_TRUST_PROXY: "1",
        SITE_URL: `http://localhost:${webPort}`,
        // Chat: only the mock Anthropic API, whatever keys the root .env holds. A low rate limit, for
        // e2e/chat.spec.ts (each test is its own visitor, so tests don't share it).
        ANTHROPIC_BASE_URL: `http://localhost:${mockLlmPort}`,
        ANTHROPIC_API_KEY: "e2e",
        OPENAI_API_KEY: "",
        GEMINI_API_KEY: "",
        CHAT_RATE_LIMIT: "3",
        MY_DATA: "on",
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Servers start in order, so the build above already exists.
      command: `exec node_modules/.bin/next start --port ${apiDownWebPort}`,
      url: `http://localhost:${apiDownWebPort}`,
      env: { ...process.env, ...chatDefaults, API_URL: "http://localhost:9/graphql" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
