import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";

/**
 * Health check.
 *
 * The database check runs a real query through the pooled connection, which is
 * the only thing that proves `prepare: false` and the transaction-pooler
 * connection string are correct together. A build that compiles and a page
 * that renders prove neither.
 *
 * To add a provider later, push another entry into `checks` — the response
 * shape is `{ ok, ...checks, timestamp }`, so new keys appear automatically
 * and `ok` stays the AND of everything.
 */

// Never statically optimised: a cached "ok" would be worthless.
export const dynamic = "force-dynamic";

type CheckName = "db";

export async function GET() {
  const checks: Record<CheckName, boolean> = { db: false };

  try {
    await db.select({ id: plans.id }).from(plans).limit(1);
    checks.db = true;
  } catch {
    checks.db = false;
  }

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { ok, ...checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
