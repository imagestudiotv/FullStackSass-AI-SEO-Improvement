import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/lib/db/schema";

import { draftStatements } from "./drafts";

/**
 * A disposable Postgres for tests: PGlite, in-process, built by replaying the
 * real migrations in drizzle/ in journal order. Nothing here can reach the
 * database in .env.local.
 *
 * Use with vi.mock("@/lib/db", ...) pointing `db` at `testDb().db`.
 *
 * One substitution: PGlite ships without pgvector, so the single
 * vector(1536) column (pages.embedding) is created as text. No test touches it.
 */

const root = path.resolve(__dirname, "../..");

type Journal = { entries: { tag: string }[] };

/**
 * Schema changes drafted on a feature branch before the integrator turns them
 * into a canonical migration (drizzle-drafts/, in name order). Applied after
 * the whole chain only: a test that stops at an earlier migration gets none.
 */
export function draftMigrations(): string[] {
  const folder = path.join(root, "drizzle-drafts");
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(path.join(folder, name), "utf8"));
}

/** Applies one migration file to a database, statement by statement. */
export async function applyMigration(client: PGlite, tag: string) {
  const file = readFileSync(path.join(root, "drizzle", `${tag}.sql`), "utf8");
  const statements = file
    .replace(/vector\(\d+\)/g, "text")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await client.exec(statement);
}

export async function createTestDb(
  /** Stop after this migration tag, to test what a later one does to existing rows. */
  options: { through?: string } = {},
) {
  const client = new PGlite();
  const journal = JSON.parse(
    readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
  ) as Journal;

  const files: string[] = [];
  for (const { tag } of journal.entries) {
    files.push(readFileSync(path.join(root, "drizzle", `${tag}.sql`), "utf8"));
    if (options.through === tag) break;
  }
  if (!options.through) files.push(...draftMigrations());

  for (const file of files) {
    const statements = file
      .replace(/vector\(\d+\)/g, "text")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.exec(statement);
    }
  }
  // Schema drafts awaiting a canonical migration (src/test/drafts.ts); full replays only.
  if (!options.through) for (const statement of draftStatements(root)) await client.exec(statement);

  const db = drizzle(client, { schema });
  return { client, db };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
