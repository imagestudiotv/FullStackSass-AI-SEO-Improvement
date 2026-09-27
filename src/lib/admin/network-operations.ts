"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { AUTHORITY_METRIC } from "@/lib/authority/metric";
import { db } from "@/lib/db";
import { domainMetrics, publicationDispatches } from "@/lib/db/schema";
import { isDataForSeoConfigured } from "@/lib/providers/dataforseo";
import { readControls, writeControl, type ControlKey, type ControlState } from "@/lib/publishing/controls";
import { IN_FLIGHT_TIMEOUT_MS } from "@/lib/publishing/dispatch";
import {
  activePolicy,
  listPolicies,
  publishPolicy,
  validatePolicy,
  type BacklinkRate,
  type ClickValueMode,
  type ValuationPolicy,
} from "@/lib/valuation/policy";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * A Date as a SQL parameter in a RAW template. postgres-js (production) does
 * not serialize Date objects there - only drizzle's typed operators do - so
 * raw templates pass UTC ISO text. For a `timestamp` column Postgres ignores
 * the zone designator, which is exactly the UTC wall-clock these columns hold.
 */
const utc = (date: Date) => date.toISOString();


/**
 * Operator controls for the managed network: the publication freeze and the
 * managed-review switch (lib/publishing/controls.ts), authority collection
 * (lib/authority/collect.ts) and the valuation policy (lib/valuation/policy.ts).
 * Every change is admin-only and written to the audit log in the same
 * transaction as the change.
 */

export type Operations = {
  controls: ControlState[];
  /** Sends in flight now (claimed within the in-flight timeout, no outcome yet). */
  inFlight: number;
  authority: {
    configured: boolean;
    metric: string;
    byStatus: Record<string, number>;
    lastAttemptAt: Date | null;
    lastError: string | null;
  };
  policy: ValuationPolicy | null;
  policies: ValuationPolicy[];
};

export async function getOperations(): Promise<Operations> {
  await requireAdmin();
  const since = new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS);
  const [controls, [flying], statuses, [last], policy, policies] = await Promise.all([
    readControls(),
    db
      .select({ n: count() })
      .from(publicationDispatches)
      .where(and(eq(publicationDispatches.status, "in_flight"), sql`${publicationDispatches.claimedAt} > ${utc(since)}`)),
    db
      .select({ status: domainMetrics.status, n: count() })
      .from(domainMetrics)
      .where(and(eq(domainMetrics.provider, AUTHORITY_METRIC.provider), eq(domainMetrics.metric, AUTHORITY_METRIC.metric)))
      .groupBy(domainMetrics.status),
    db
      .select({ at: domainMetrics.attemptedAt, error: domainMetrics.error })
      .from(domainMetrics)
      .where(sql`${domainMetrics.attemptedAt} is not null`)
      .orderBy(sql`${domainMetrics.attemptedAt} desc`)
      .limit(1),
    activePolicy(),
    listPolicies(),
  ]);
  return {
    controls,
    inFlight: flying?.n ?? 0,
    authority: {
      configured: isDataForSeoConfigured(),
      metric: `${AUTHORITY_METRIC.label} (0-${AUTHORITY_METRIC.scaleMax})`,
      byStatus: Object.fromEntries(statuses.map((s) => [s.status, s.n])),
      lastAttemptAt: last?.at ?? null,
      lastError: last?.error ?? null,
    },
    policy,
    policies,
  };
}

export async function setControl(key: ControlKey, enabled: boolean, reason: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (key !== "publication_freeze" && key !== "managed_review") return { ok: false, error: "Unknown control" };
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: "Give a short reason - it is kept in the audit log" };
  await db.transaction(async (tx) => {
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "platform.control_changed",
        targetType: "platform_control",
        targetId: key,
        summary: `${enabled ? "Enabled" : "Disabled"} ${key.replace("_", " ")}: ${why}`,
        detail: { key, enabled, reason: why },
      },
      tx,
    );
    await writeControl(key, enabled, { reason: why, actor: admin.email }, tx);
  });
  revalidatePath("/admin/network/operations");
  return { ok: true, data: null };
}

export async function requestAuthorityCollection(): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!isDataForSeoConfigured()) return { ok: false, error: "DataForSEO is not configured on this deployment" };
  await recordAdminAction({
    actorEmail: admin.email,
    action: "authority.collection_requested",
    targetType: "authority",
    summary: "Requested an authority collection run",
  });
  // One run per ten minutes whatever is clicked; the job itself is capped per day.
  await inngest.send({ id: `authority-collect:${Math.floor(Date.now() / 600_000)}`, name: "authority/collect.requested", data: {} });
  return { ok: true, data: null };
}

export async function publishValuationPolicy(input: {
  currency: string;
  clickValueMode: ClickValueMode;
  fixedClickRate: number | null;
  backlinkRates: BacklinkRate[];
  sources: string;
  notes: string | null;
  effectiveFrom: string;
}): Promise<ActionResult<{ version: number }>> {
  const admin = await requireAdmin();
  const parsed = {
    ...input,
    currency: input.currency.trim().toUpperCase(),
    effectiveFrom: new Date(input.effectiveFrom),
  };
  const error = validatePolicy(parsed);
  if (error) return { ok: false, error };
  const policy = await db.transaction(async (tx) => {
    // One publisher at a time, so two versions cannot take the same number.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('valuation-policy'))`);
    const created = await publishPolicy(parsed, admin.email, tx);
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "valuation.policy_published",
        targetType: "valuation_policy",
        targetId: created.id,
        summary: `Published valuation policy v${created.version} (${created.currency})`,
        detail: {
          version: created.version,
          currency: created.currency,
          clickValueMode: created.clickValueMode,
          fixedClickRate: created.fixedClickRate,
          backlinkRates: created.backlinkRates,
          sources: created.sources,
          effectiveFrom: created.effectiveFrom.toISOString(),
        },
      },
      tx,
    );
    return created;
  });
  revalidatePath("/admin/network/operations");
  return { ok: true, data: { version: policy.version } };
}
