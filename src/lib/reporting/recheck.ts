import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { backlinkRequests, placements } from "@/lib/db/schema";
import { recheckPolicy, type Direction, type Lifecycle } from "@/lib/reporting/backlinks";

/**
 * "Check again" / "Recover credits" - an EARLY verification, never a grant.
 *
 * It only marks the placement for the verifier (placements.recheck_requested_at,
 * picked first by placementsDue) and wakes the verification job. Credits move
 * exactly as they always do: when the verifier sees the link live on the
 * published page (lib/backlinks/placements.ts, applyCheck), once, by its
 * idempotency keys. Nothing is republished and no approval is bypassed.
 *
 * A link NOT FOUND after repeated checks (status unverified) gets one more
 * chance when its host has fixed the article: it returns to "awaiting
 * verification" - only if its request is still open and has not been given
 * another placement since, so a recovered link can never be charged twice.
 *
 * Limits: editors of the side that owns the link; one request per placement
 * per RECHECK_COOLDOWN_MS; the placement row is locked while deciding, so two
 * clicks cannot both pass.
 */

export type RecheckResult =
  | { ok: true; revived: boolean }
  | { ok: false; reason: "not_found" | "not_checkable" | "queued" | "cooldown" | "superseded" };

const LIFECYCLE: Record<string, Lifecycle> = {
  pending: "awaiting_publication",
  drafted: "awaiting_publication",
  published: "awaiting_verification",
  live: "verified",
  unverified: "not_found",
  removed: "removed",
  cancelled: "withdrawn",
};

export async function requestRecheck(
  direction: Direction,
  websiteId: string,
  placementId: string,
  now: Date = new Date(),
): Promise<RecheckResult> {
  if (!/^[0-9a-f-]{36}$/i.test(placementId)) return { ok: false, reason: "not_found" };
  const outcome = await db.transaction(async (tx): Promise<RecheckResult> => {
    const [row] = await tx
      .select({
        id: placements.id,
        status: placements.status,
        requestId: placements.requestId,
        liveUrl: placements.liveUrl,
        hostWebsiteId: placements.hostWebsiteId,
        beneficiaryWebsiteId: backlinkRequests.websiteId,
        requestStatus: backlinkRequests.status,
        recheckRequestedAt: placements.recheckRequestedAt,
        lastVerifiedAt: placements.lastVerifiedAt,
      })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .where(eq(placements.id, placementId))
      .for("update", { of: placements });
    // Only the side asking may ask: the beneficiary for received links, the host for given ones.
    const owner = direction === "received" ? row?.beneficiaryWebsiteId : row?.hostWebsiteId;
    if (!row || owner !== websiteId) return { ok: false, reason: "not_found" };

    const lifecycle = LIFECYCLE[row.status] ?? "unknown";
    const policy = recheckPolicy(direction, lifecycle, row.recheckRequestedAt, row.lastVerifiedAt, now);
    if (!policy.allowed) return { ok: false, reason: (policy.reason ?? "not_checkable") as "not_checkable" | "queued" | "cooldown" };
    if (!row.liveUrl) return { ok: false, reason: "not_checkable" };

    let revived = false;
    if (row.status === "unverified") {
      // Still wanted, and not given to another placement since?
      const [other] = await tx
        .select({ id: placements.id })
        .from(placements)
        .where(
          and(
            eq(placements.requestId, row.requestId),
            ne(placements.id, row.id),
            inArray(placements.status, ["pending", "drafted", "published", "live"]),
          ),
        )
        .limit(1);
      if (other || row.requestStatus !== "pending") return { ok: false, reason: "superseded" };
      await tx
        .update(placements)
        .set({ status: "published", updatedAt: now })
        .where(and(eq(placements.id, row.id), eq(placements.status, "unverified")));
      await tx
        .update(backlinkRequests)
        .set({ status: "matched", updatedAt: now })
        .where(and(eq(backlinkRequests.id, row.requestId), eq(backlinkRequests.status, "pending")));
      revived = true;
    }
    await tx
      .update(placements)
      .set({ recheckRequestedAt: now, updatedAt: now })
      .where(eq(placements.id, row.id));
    return { ok: true, revived };
  });

  if (outcome.ok) {
    // Wakes the verifier; one wake-up per placement per hour whatever is clicked.
    await inngest
      .send({ id: `recheck:${placementId}:${Math.floor(now.getTime() / 3_600_000)}`, name: "backlinks/verify.requested", data: {} })
      .catch((error) => console.error("[recheck] could not wake the verifier; the daily run will check it", error));
  }
  return outcome;
}

/**
 * "Recover credits": asks for a re-check of every link NOT FOUND on this
 * website's own published articles (bounded), each under the same rules.
 */
export async function requestRecoveryChecks(websiteId: string, now: Date = new Date()): Promise<{ requested: number; skipped: number }> {
  const rows = await db
    .select({ id: placements.id })
    .from(placements)
    .where(and(eq(placements.hostWebsiteId, websiteId), eq(placements.status, "unverified")))
    .orderBy(sql`${placements.updatedAt} desc`)
    .limit(50);
  let requested = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await requestRecheck("given", websiteId, row.id, now);
    if (result.ok) requested++;
    else skipped++;
  }
  return { requested, skipped };
}
