import { readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/lib/db/schema";

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

export async function createTestDb() {
  const client = new PGlite();
  const journal = JSON.parse(
    readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
  ) as Journal;

  for (const { tag } of journal.entries) {
    const file = readFileSync(path.join(root, "drizzle", `${tag}.sql`), "utf8");
    const statements = file
      .replace(/vector\(\d+\)/g, "text")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.exec(statement);
    }
  }

  const db = drizzle(client, { schema });
  return { client, db };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
