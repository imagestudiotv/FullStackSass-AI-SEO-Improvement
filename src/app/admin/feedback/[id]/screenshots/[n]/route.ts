import { and, eq } from "drizzle-orm";

import { isAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { feedbackScreenshots } from "@/lib/db/schema";
import { FEEDBACK_LIMITS } from "@/lib/feedback/shared";

/**
 * A feedback message's picture number n (1, 2, 3... as the sender added
 * them), for administrators only. It may show someone's dashboard, so it is
 * kept in the database rather than the public picture bucket, and to anyone
 * else this address does not exist - the same 404 as the rest of /admin.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  if (!(await isAdmin())) return notFound();
  const { id, n } = await params;
  const position = /^[1-9]\d?$/.test(n) ? Number(n) : 0;
  if (!UUID.test(id) || position < 1 || position > FEEDBACK_LIMITS.screenshots) return notFound();
  const [row] = await db
    .select({ data: feedbackScreenshots.data, type: feedbackScreenshots.type })
    .from(feedbackScreenshots)
    .where(and(eq(feedbackScreenshots.feedbackId, id), eq(feedbackScreenshots.position, position)))
    .limit(1);
  if (!row) return notFound();
  return new Response(new Uint8Array(row.data), {
    headers: {
      // Always the WebP it was re-encoded to (lib/feedback/send.ts); never a type the sender chose.
      "content-type": row.type === "image/webp" ? "image/webp" : "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
