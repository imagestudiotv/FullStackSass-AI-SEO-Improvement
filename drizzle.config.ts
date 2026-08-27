import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own. Load it the same way
// Next.js does so the CLI and the app always see identical values.
loadEnvConfig(process.cwd());

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL is not set");
}

/**
 * Migrations and DDL run over the direct / session connection (port 5432),
 * never the transaction pooler. The pooler will fail or behave oddly on
 * schema changes.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
});
