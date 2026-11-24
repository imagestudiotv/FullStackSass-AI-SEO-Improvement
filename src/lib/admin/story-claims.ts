import "server-only";

import { and, count, eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { earnSubmissions } from "@/lib/db/schema";

/** Customer stories sent through Earn Credits and not decided yet, for the Success stories page. */
export async function countStoryClaims(): Promise<number> {
  await requireAdmin();
  const [row] = await db
    .select({ n: count() })
    .from(earnSubmissions)
    .where(and(eq(earnSubmissions.status, "pending"), eq(earnSubmissions.kind, "story")));
  return Number(row?.n ?? 0);
}
