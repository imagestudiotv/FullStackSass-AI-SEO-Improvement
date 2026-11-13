import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Hand-written migrations not yet numbered into drizzle/ (Nov 13 ticket),
 * replayed by src/test/db.ts and src/test/postgres.ts after the journal's,
 * so the tables and columns schema.ts describes exist in a test database.
 * When a draft becomes a numbered migration in drizzle/, its entry here is
 * removed (each draft is also safe to run twice, should it be left in).
 */
export const DRAFT_MIGRATIONS: string[] = [];

const root = path.resolve(__dirname, "../..");

/** The drafts' statements, in order; vector columns as text unless `keepVector` (as the journal's are). */
export function draftStatements(keepVector = false): string[] {
  return DRAFT_MIGRATIONS.flatMap((file) => {
    const sql = readFileSync(path.join(root, file), "utf8");
    return (keepVector ? sql : sql.replace(/vector\(\d+\)/g, "text"))
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
  });
}
