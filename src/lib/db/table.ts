import { pgTable as drizzlePgTable, type PgTableFn } from "drizzle-orm/pg-core";

/**
 * `pgTable`, with Row Level Security enabled on every table it declares.
 *
 * Every table in this schema is server-side only: the application reads and
 * writes through Drizzle as the database owner (which carries BYPASSRLS),
 * never through Supabase's Data API. RLS with no policy denies every row to
 * every other role, so a table that somehow became reachable through `anon`
 * or `authenticated` still returns nothing. Declaring it here makes
 * `drizzle-kit generate` write `ENABLE ROW LEVEL SECURITY` into the migration
 * that creates the table, so a new table cannot ship without it.
 *
 * Do NOT add policies to "make something work": nothing outside the server
 * should read these tables. Grants are handled by migration
 * 0056_rls_hardening (and checked in src/lib/db/rls.postgres.test.ts).
 *
 * Import `pgTable` from here, not from "drizzle-orm/pg-core".
 */
export const pgTable = ((...args: unknown[]) =>
  (drizzlePgTable as unknown as (...a: unknown[]) => { enableRLS: () => unknown })(
    ...args,
  ).enableRLS()) as unknown as PgTableFn;
