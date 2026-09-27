import { eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { platformControls } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * Operator switches read by every publishing path (see platform_controls in
 * the schema).
 *
 *   publication_freeze - nothing is sent to any customer site while enabled.
 *     Checked inside the dispatch claim (lib/publishing/dispatch.ts), so it
 *     also stops queued jobs, retries and the plugin feed, not only new
 *     requests. A send already in flight completes - it cannot be recalled.
 *   managed_review     - new drafts on Partner Network websites enter the
 *     RepGet team's review only while enabled. Enabled by an operator once a
 *     deploy has finished, so no article is held while an older build that
 *     ignores review_status may still be serving.
 *
 * A missing row means disabled: a fresh database, or one a previous build
 * migrated, behaves exactly as before until an operator acts.
 */
export type ControlKey = "publication_freeze" | "managed_review";

export const CONTROL_KEYS: ControlKey[] = ["publication_freeze", "managed_review"];

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
 * True while the freeze is on, for queries that pick articles to send: the
 * plugin feed and the scheduled release skip everything while frozen, so a
 * frozen system does not even hand work to the dispatch claim.
 */
export const notFrozenSql: SQL = sql`not exists (
  select 1 from platform_controls pc where pc.key = 'publication_freeze' and pc.enabled
)`;
