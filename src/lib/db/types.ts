import type { ExtractTablesWithRelations } from "drizzle-orm";
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTransaction,
} from "drizzle-orm/pg-core";

import type * as schema from "@/lib/db/schema";

/**
 * The app's database, typed by driver-independent Postgres interfaces.
 *
 * Helpers that take the database as an argument use these rather than the
 * postgres-js type, so the same code runs against the app's client and the
 * disposable test databases (PGlite, or a real Postgres for the concurrency
 * tests).
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Transaction = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Either one: anything that can run a query. */
export type Executor = Database | Transaction;
