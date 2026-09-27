import { eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, networkSites, platformControls } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * Operator switches read by every publishing path (see platform_controls in
 * the schema).
 *
 *   publication_freeze - nothing is sent to any customer site while enabled.
 *     Checked inside the dispatch claim (lib/publishing/dispatch.ts), so it
 *     also stops queued jobs, retries and the plugin feed, not only new
 *     requests. Enabling it takes FREEZE_LOCK exclusively; every claim holds
 *     it shared - so when enabling returns, no claim that read "not frozen"
 *     is still open. A send already admitted completes (it cannot be
 *     recalled): the operations page lists every attempt whose outcome is
 *     not yet known, and "drained" means none are left.
 *   managed_review     - new drafts on Partner Network websites enter the
 *     RepGet team's review only while enabled. Enabled by an operator once a
 *     deploy has finished, so no article is held while an older build that
 *     ignores review_status may still be serving. Enabling it also holds the
 *     drafts written since this build's migration while it was off
 *     (activateManagedReview), under REVIEW_LOCK, which the generation save
 *     step holds shared while it decides a draft's review state - so no
 *     draft slips between the two.
 *
 * A missing row means disabled: a fresh database, or one a previous build
 * migrated, behaves exactly as before until an operator acts.
 */
export type ControlKey = "publication_freeze" | "managed_review";

export const CONTROL_KEYS: ControlKey[] = ["publication_freeze", "managed_review"];

/** Advisory-lock keys: shared by claims / generation saves, exclusive by the switch. */
export const FREEZE_LOCK = sql`hashtext('repget:publication-freeze')`;
/** Also taken (shared) by reviewStatusForNewDraft in lib/articles/review.ts, by the same key. */
export const REVIEW_LOCK = sql`hashtext('repget:managed-review')`;

/**
 * Written by migration 0045: when this build's schema arrived. Drafts written
 * from then on are covered by managed-review activation; older drafts keep the
 * behaviour they were written under.
 */
export const REVIEW_CUTOVER_KEY = "managed_review_cutover";

export async function isControlEnabled(key: ControlKey, executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ enabled: platformControls.enabled })
    .from(platformControls)
    .where(eq(platformControls.key, key))
    .limit(1);
  return row?.enabled ?? false;
}

export type ControlState = { key: ControlKey; enabled: boolean; reason: string | null; updatedBy: string | null; updatedAt: Date | null };

export async function readControls(executor: Executor = db): Promise<ControlState[]> {
  const rows = await executor.select().from(platformControls);
  return CONTROL_KEYS.map((key) => {
    const row = rows.find((r) => r.key === key);
    return {
      key,
      enabled: row?.enabled ?? false,
      reason: row?.reason ?? null,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Sets a switch. Callers authorize (lib/admin/network.ts) and audit. */
export async function writeControl(
  key: ControlKey,
  enabled: boolean,
  meta: { reason: string | null; actor: string },
  executor: Executor = db,
): Promise<void> {
  const now = new Date();
  await executor
    .insert(platformControls)
    .values({ key, enabled, reason: meta.reason, updatedBy: meta.actor, updatedAt: now })
    .onConflictDoUpdate({
      target: platformControls.key,
      set: { enabled, reason: meta.reason, updatedBy: meta.actor, updatedAt: now },
    });
}

/**
 * Sets a switch with the locks it needs - inside the caller's transaction,
 * which also writes the audit record.
 *
 *   freeze on - waits for every open claim (FREEZE_LOCK exclusive).
 *   review    - waits for every generation save deciding a review state
 *               (REVIEW_LOCK exclusive); switched on, it then holds for
 *               review the unpublished drafts written since the cutover on
 *               websites taking part in the network, and returns how many.
 */
export async function switchControl(
  tx: Executor,
  key: ControlKey,
  enabled: boolean,
  meta: { reason: string | null; actor: string },
): Promise<{ heldForReview: number }> {
  if (key === "publication_freeze" && enabled) {
    await tx.execute(sql`select pg_advisory_xact_lock(${FREEZE_LOCK})`);
  }
  if (key === "managed_review") {
    await tx.execute(sql`select pg_advisory_xact_lock(${REVIEW_LOCK})`);
  }
  await writeControl(key, enabled, meta, tx);
  if (key !== "managed_review" || !enabled) return { heldForReview: 0 };
  return { heldForReview: await activateManagedReview(tx) };
}

/**
 * Drafts written while managed review was off - during the deploy, or by
 * work the previous build queued - on websites now in the Partner Network,
 * held for the RepGet team. Only drafts written since the cutover
 * (REVIEW_CUTOVER_KEY), never delivered, not already under review, and not
 * in the middle of a delivery.
 */
export async function activateManagedReview(tx: Executor): Promise<number> {
  const rows = await tx
    .update(articles)
    .set({ reviewStatus: "pending", reviewVersion: sql`${articles.reviewVersion} + 1` })
    .where(
      sql`${articles.reviewStatus} is null
        and ${articles.status} in ('draft', 'generating', 'queued')
        and ${articles.publishedUrl} is null
        and ${articles.createdAt} >= (select pc.updated_at from ${platformControls} pc where pc.key = ${REVIEW_CUTOVER_KEY})
        and exists (select 1 from ${networkSites} ns where ns.website_id = ${articles.websiteId} and ns.accepting_links)
        and not exists (select 1 from publication_dispatches pd where pd.article_id = ${articles.id} and pd.status = 'in_flight')`,
    )
    .returning({ id: articles.id });
  return rows.length;
}

/**
 * True while the freeze is on, for queries that pick articles to send: the
 * plugin feed and the scheduled release skip everything while frozen, so a
 * frozen system does not even hand work to the dispatch claim.
 */
export const notFrozenSql: SQL = sql`not exists (
  select 1 from platform_controls pc where pc.key = 'publication_freeze' and pc.enabled
)`;
