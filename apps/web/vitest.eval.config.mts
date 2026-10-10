import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// The CV coach eval (evals/*.eval.ts): real model calls, so it's its own run, never part of `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(dirname, "src"),
      "server-only": path.join(dirname, "evals/support/server-only.ts"),
    },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    environment: "node",
    // Prints the report (console output) even when the run passes.
    reporters: ["verbose"],
    // A full run is hundreds of model calls.
    testTimeout: 60 * 60 * 1000,
  },
});
