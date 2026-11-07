import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Draft schema changes not yet turned into canonical migrations
 * (drizzle-drafts/<area>/*.sql). A parallel branch may change schema.ts but
 * must not write drizzle/ files of its own: the integrator generates the one
 * canonical migration from the combined schema, then deletes the drafts. Until
 * then the test databases apply them after drizzle/, so tests see the schema
 * the code declares. Without the folder this returns nothing.
 *
 * Applied only on a full replay: a test that stops at an earlier migration is
 * testing that migration, not today's schema.
 */
export function draftStatements(root: string): string[] {
  const folder = path.join(root, "drizzle-drafts");
  if (!existsSync(folder)) return [];
  const files = readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split(path.sep).join("/"))
    .sort();
  return files.flatMap((name) =>
    readFileSync(path.join(folder, name), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      // A file's leading comment lines belong to its first statement; drop pure-comment chunks.
      .filter((statement) => statement.split("\n").some((line) => line.trim() && !line.trim().startsWith("--"))),
  );
}
