import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Partner-program browser tests (README.md). Run against the isolated app
 * started by `node e2e/partners/app.mjs start`, whose state file names the
 * app's address and the throwaway database the tests also write to.
 * Refuses anything but localhost and a repget_e2e_* database.
 */
const root = path.resolve(__dirname, "../..");
const stateFile = process.env.E2E_STATE ?? path.join(tmpdir(), "repget-e2e-partners.json");
if (!existsSync(stateFile)) throw new Error(`no ${stateFile}: start the app with node e2e/partners/app.mjs start first`);
const state = JSON.parse(readFileSync(stateFile, "utf8")) as { baseUrl: string; databaseUrl: string };
const local = (url: string) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
if (!local(state.baseUrl) || !local(state.databaseUrl)) throw new Error("the browser tests run only against localhost");
if (!/^\/repget_e2e_[a-z0-9_]+$/.test(new URL(state.databaseUrl).pathname)) throw new Error("the browser tests write only to a repget_e2e_* database");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "src/test/server-only.ts"),
    },
  },
  test: {
    root,
    environment: "node",
    include: ["e2e/partners/**/*.e2e.ts"],
    // One browser and one database: files run one after another.
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 180_000,
    env: {
      E2E_STATE_FILE: stateFile,
      DATABASE_URL: state.databaseUrl,
      DIRECT_URL: state.databaseUrl,
      // Nothing in the tests' own process may reach a real provider.
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
    },
  },
});
