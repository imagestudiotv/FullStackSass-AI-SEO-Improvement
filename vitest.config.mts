import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Unit and regression tests. Server code only: every test runs in Node
 * against an in-process PGlite database (see src/test/db.ts), never the
 * DATABASE_URL in .env.local, and every paid provider is mocked.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Replaying every migration into a fresh PGlite takes a few seconds.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Tests must never reach a real database or provider by accident.
    env: {
      DATABASE_URL: "",
      DIRECT_URL: "",
      ANTHROPIC_API_KEY: "test-key-not-real",
    },
  },
});
