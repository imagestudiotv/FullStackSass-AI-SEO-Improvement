import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as authTables from "./auth-tables";
import * as schema from "./schema";

/**
 * Every table is declared with Row Level Security (src/lib/db/table.ts), so
 * `drizzle-kit generate` writes ENABLE ROW LEVEL SECURITY into the migration
 * that creates it. blog_posts, blog_categories and plugin_connect_requests
 * shipped without it because RLS used to live only in hand-written SQL.
 */
describe("schema", () => {
  const exported: unknown[] = [...Object.values(schema), ...Object.values(authTables)];
  const tables = [...new Set(exported.filter((value) => is(value, PgTable)))] as PgTable[];
  const configs = tables.map((table) => getTableConfig(table));

  it("declares row level security on every table", () => {
    expect(tables.length).toBeGreaterThanOrEqual(67);
    expect(configs.filter((config) => !config.enableRLS).map((config) => config.name)).toEqual([]);
  });

  it("declares no policies (the server is the only reader)", () => {
    expect(configs.filter((config) => config.policies.length).map((config) => config.name)).toEqual([]);
  });
});
