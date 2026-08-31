import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Database client, created on first query.
 *
 * Constructed lazily for the same reason as the Stripe and Anthropic clients:
 * `next build` evaluates every route module to collect page data, so a
 * module-scope throw fails the whole build on any machine without
 * DATABASE_URL — a fresh Vercel deploy, CI, or a new clone. Deferring it means
 * the build succeeds and only a request that actually needs the database
 * fails, with the same clear message.
 */

let client: ReturnType<typeof postgres> | null = null;
let instance: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    /**
     * Supabase's transaction-mode pooler (port 6543) does not support prepared
     * statements, which postgres-js uses by default. Without `prepare: false`
     * every query works locally against a direct connection and then fails
     * once deployed. Do not remove this flag.
     */
    client = postgres(url, { prepare: false });
    instance = drizzle(client, { schema });
  }
  return instance;
}

/** True when a connection string is configured. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Proxy so every existing `db.select(...)` call site keeps working unchanged
 * while construction stays deferred to first property access.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
