import { eq } from "drizzle-orm";

import { isAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

/**
 * A feedback message's screenshot (lib/feedback), for administrators only.
 * It may show someone's dashboard, so it is kept in the database rather
 * than the public picture bucket, and to anyone else this address does not
 * exist - the same 404 as the rest of /admin.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return notFound();
  const { id } = await params;
  if (!UUID.test(id)) return notFound();
  const [row] = await db.select({ screenshot: feedback.screenshot, type: feedback.screenshotType }).from(feedback).where(eq(feedback.id, id)).limit(1);
  if (!row?.screenshot) return notFound();
  return new Response(new Uint8Array(row.screenshot), {
    headers: {
      // Always the WebP it was re-encoded to (lib/feedback/send.ts); never a type the sender chose.
      "content-type": row.type === "image/webp" ? "image/webp" : "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
