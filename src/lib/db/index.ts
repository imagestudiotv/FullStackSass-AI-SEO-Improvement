import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

/**
 * Supabase's transaction-mode pooler (port 6543) does not support prepared
 * statements, which postgres-js uses by default. Without `prepare: false`
 * every query works locally against a direct connection and then fails once
 * deployed. Do not remove this flag.
 */
const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
