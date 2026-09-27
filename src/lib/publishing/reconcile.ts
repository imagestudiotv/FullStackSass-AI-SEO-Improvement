import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { publicationDispatches, publishLogs } from "@/lib/db/schema";
import { loadCredentialsById } from "@/lib/publishing/credentials";
import { reconcileUncertain, recordLookup } from "@/lib/publishing/dispatch";
import { judgeCandidates } from "@/lib/publishing/ownership";
import type { CmsProvider } from "@/lib/publishing/provider";

/**
 * Looks for the post an UNCERTAIN direct send may have created, by that
 * dispatch's own identity (lib/publishing/ownership.ts) - on the integration
 * it was sent to, not whatever is connected now - and adopts it only on
 * proof. Never by slug, never from the article's current fields.
 *
 *   adopted  - exactly one post carries this dispatch's marker: the dispatch
 *              is settled "sent" (recorded as a system reconciliation) and
 *              its delivery is logged once.
 *   held     - nothing found yet, several candidates, content withheld, no
 *              marker on record (a send from before markers), no lookup for
 *              this CMS, or the site could not be asked. It stays uncertain;
 *              each lookup is counted. Nothing is created meanwhile.
 */

export type Uncertain = typeof publicationDispatches.$inferSelect;

export type ReconcileOutcome =
  | { adopted: true; remoteId: string; remoteUrl: string; status: string }
  | { adopted: false; result: "none" | "ambiguous" | "unverifiable" | "error" | "unsupported" | "disconnected"; attempts: number };

export async function reconcileDirectUncertain(
  unknown: Uncertain,
  provider: Pick<CmsProvider, "searchPostsByMarker">,
  fallbackIntegrationId: string,
): Promise<ReconcileOutcome> {
  const snapshot = (unknown.requestSnapshot ?? null) as { marker?: string } | null;
  if (!provider.searchPostsByMarker) return { adopted: false, result: "unsupported", attempts: unknown.lookupAttempts };
  if (!snapshot?.marker) {
    // Sent before ownership markers existed: nothing on the site can prove it is ours.
    const attempts = await recordLookup(unknown.id, "unverifiable");
    return { adopted: false, result: "unverifiable", attempts };
  }
  const integration = await loadCredentialsById(unknown.integrationId ?? fallbackIntegrationId);
  if (!integration) return { adopted: false, result: "disconnected", attempts: unknown.lookupAttempts };

  let candidates;
  try {
    candidates = await provider.searchPostsByMarker(integration.credentials, unknown.id);
  } catch {
    const attempts = await recordLookup(unknown.id, "error");
    return { adopted: false, result: "error", attempts };
  }
  const verdict = judgeCandidates(candidates, { articleId: unknown.articleId, websiteId: unknown.websiteId, dispatchId: unknown.id });
  if (verdict.result !== "found") {
    const attempts = await recordLookup(unknown.id, verdict.result);
    return { adopted: false, result: verdict.result, attempts };
  }

  const post = verdict.post;
  await db.transaction(async (tx) => {
    const settled = await reconcileUncertain(
      unknown.id,
      { status: "sent", remoteId: post.remoteId, remoteUrl: post.remoteUrl, remoteStatus: post.status },
      { by: "system:ownership-marker", note: `Found post ${post.remoteId} carrying this dispatch's marker` },
      tx,
    );
    await recordLookupFound(tx, unknown.id);
    if (settled) {
      await tx
        .insert(publishLogs)
        .values({
          articleId: unknown.articleId,
          integrationId: unknown.integrationId ?? fallbackIntegrationId,
          dispatchId: unknown.id,
          status: "published",
          remoteId: post.remoteId,
          remoteUrl: post.remoteUrl,
          remoteStatus: post.status,
        })
        .onConflictDoNothing();
    }
  });
  return { adopted: true, remoteId: post.remoteId, remoteUrl: post.remoteUrl, status: post.status };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recordLookupFound(tx: Tx, dispatchId: string) {
  await tx
    .update(publicationDispatches)
    .set({ lookupAttempts: sql`${publicationDispatches.lookupAttempts} + 1`, lastLookupAt: new Date(), lookupResult: "found" })
    .where(eq(publicationDispatches.id, dispatchId));
}

/** Delay before the next automatic lookup of an uncertain send; null = stop and wait for a person. */
export function nextLookupDelayMs(attempts: number): number | null {
  const MAX_AUTOMATIC_LOOKUPS = 8;
  if (attempts >= MAX_AUTOMATIC_LOOKUPS) return null;
  // 5, 10, 20, 40 minutes ... capped at 6 hours: a slow create lands in minutes.
  return Math.min(5 * 60_000 * 2 ** Math.max(0, attempts - 1), 6 * 3_600_000);
}
