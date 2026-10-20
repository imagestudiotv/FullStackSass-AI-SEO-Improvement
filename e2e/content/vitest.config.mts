import path from "node:path";
import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

// Explicit opt-in: uses paid research/AI, but never a customer database or CMS.
if (process.env.REPGET_CONTENT_LIVE_PILOT !== "1") throw new Error("Set REPGET_CONTENT_LIVE_PILOT=1 to run the bounded live content pilot.");
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.ANTHROPIC_API_KEY || !process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
  throw new Error("The live pilot requires Anthropic and DataForSEO credentials.");
}
export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src"), "server-only": path.resolve(process.cwd(), "src/test/server-only.ts") } },
  test: {
    include: ["e2e/content/*.live.ts"], testTimeout: 600000, hookTimeout: 60000,
    fileParallelism: false, maxConcurrency: 2,
    env: { DATABASE_URL: "", DIRECT_URL: "", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "", ARTICLE_MODEL_RESEARCH_PLAN: "", ARTICLE_MODEL_SOURCE_SELECTION: "", ARTICLE_MODEL_RESEARCH: "",
      ARTICLE_MODEL_OUTLINE: "", ARTICLE_MODEL_BODY: "", ARTICLE_MODEL_EVIDENCE_CHECK: "", ARTICLE_MODEL_EVIDENCE_CORRECTION: "" },
  },
});
