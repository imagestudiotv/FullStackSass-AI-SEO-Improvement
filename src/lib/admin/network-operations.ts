"use server";

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { AUTHORITY_METRIC } from "@/lib/authority/metric";
import { db } from "@/lib/db";
import { articles, domainMetrics, publicationDispatches, publishLogs, websites } from "@/lib/db/schema";
import { isDataForSeoConfigured } from "@/lib/providers/dataforseo";
import { readControls, switchControl, type ControlKey, type ControlState } from "@/lib/publishing/controls";
import { dailyRequestLimit, type DailyRequestLimit } from "@/lib/authority/collect";
import { IN_FLIGHT_TIMEOUT_MS, reconcileUncertain, UNACKNOWLEDGED } from "@/lib/publishing/dispatch";
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

/** A delivery attempt whose outcome is not known yet. */
export type UnresolvedDispatch = {
  id: string;
  articleId: string;
  articleTitle: string;
  domain: string;
  channel: string;
  protocol: string | null;
  /** in_flight (live), in_flight_stale (lease ran out), uncertain, expired. */
  state: "in_flight" | "in_flight_stale" | "uncertain" | "expired";
  claimedAt: Date;
  lookupAttempts: number;
  lookupResult: string | null;
};

export type Operations = {
  controls: ControlState[];
  /**
   * Delivery attempts whose outcome is not known yet. A send can reach a
   * customer's site until its outcome is recorded, so "drained" means ALL
   * of these are zero - not merely that nothing was claimed recently. A
   * lease running out (in_flight_stale, expired) is not completion.
   */
  drain: {
    inFlight: number;
    inFlightStale: number;
    uncertain: number;
    unacknowledged: number;
    drained: boolean;
  };
  unresolved: UnresolvedDispatch[];
  authority: {
    configured: boolean;
    dailyLimit: DailyRequestLimit;
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
  const open = ["in_flight", "uncertain", ...UNACKNOWLEDGED];
  const [controls, [drain], unresolved, statuses, [last], policy, policies] = await Promise.all([
    readControls(),
    db
      .select({
        inFlight: sql<number>`count(*) filter (where ${publicationDispatches.status} = 'in_flight' and ${publicationDispatches.claimedAt} > ${utc(since)})::int`,
        inFlightStale: sql<number>`count(*) filter (where ${publicationDispatches.status} = 'in_flight' and ${publicationDispatches.claimedAt} <= ${utc(since)})::int`,
        uncertain: sql<number>`count(*) filter (where ${publicationDispatches.status} = 'uncertain')::int`,
        unacknowledged: sql<number>`count(*) filter (where ${publicationDispatches.status} in ('expired', 'abandoned'))::int`,
      })
      .from(publicationDispatches)
      .where(inArray(publicationDispatches.status, open)),
    db
      .select({
        id: publicationDispatches.id,
        articleId: publicationDispatches.articleId,
        articleTitle: articles.title,
        domain: websites.domain,
        channel: publicationDispatches.channel,
        protocol: publicationDispatches.protocol,
        status: publicationDispatches.status,
        claimedAt: publicationDispatches.claimedAt,
        lookupAttempts: publicationDispatches.lookupAttempts,
        lookupResult: publicationDispatches.lookupResult,
      })
      .from(publicationDispatches)
      .innerJoin(articles, eq(articles.id, publicationDispatches.articleId))
      .innerJoin(websites, eq(websites.id, publicationDispatches.websiteId))
      .where(inArray(publicationDispatches.status, open))
      .orderBy(publicationDispatches.claimedAt)
      .limit(50),
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
  const counts = {
    inFlight: Number(drain?.inFlight ?? 0),
    inFlightStale: Number(drain?.inFlightStale ?? 0),
    uncertain: Number(drain?.uncertain ?? 0),
    unacknowledged: Number(drain?.unacknowledged ?? 0),
  };
  return {
    controls,
    drain: { ...counts, drained: Object.values(counts).every((n) => n === 0) },
    unresolved: unresolved.map((row) => ({
      id: row.id,
      articleId: row.articleId,
      articleTitle: row.articleTitle,
      domain: row.domain,
      channel: row.channel,
      protocol: row.protocol,
      state:
        row.status === "in_flight"
          ? row.claimedAt > since ? "in_flight" : "in_flight_stale"
          : row.status === "uncertain" ? "uncertain" : "expired",
      claimedAt: row.claimedAt,
      lookupAttempts: row.lookupAttempts,
      lookupResult: row.lookupResult,
    })),
    authority: {
      configured: isDataForSeoConfigured(),
      dailyLimit: dailyRequestLimit(),
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
    // The switch first: it waits for open claims / saves (lib/publishing/controls.ts).
    const { heldForReview } = await switchControl(tx, key, enabled, { reason: why, actor: admin.email });
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "platform.control_changed",
        targetType: "platform_control",
        targetId: key,
        summary: `${enabled ? "Enabled" : "Disabled"} ${key.replace("_", " ")}: ${why}${heldForReview ? ` (${heldForReview} drafts held for review)` : ""}`,
        detail: { key, enabled, reason: why, heldForReview },
      },
      tx,
    );
  });
  revalidatePath("/admin/network/operations");
  return { ok: true, data: null };
}

/**
 * An operator's explicit decision on a delivery whose outcome is unknown,
 * audited with who, when and why - on the dispatch row and in the admin log.
 *
 *   uncertain direct send, "not_published" - an operator checked the site:
 *     the post is not there. The next publish may create it.
 *   uncertain direct send, "published"     - an operator found the post;
 *     its id and URL are recorded, so the next publish UPDATES it.
 *   expired plugin hand-over, "release"     - an older plugin never
 *     reported it and the article must move on. Its report, if it ever
 *     arrives, is still recorded (as late) - see lib/publishing/acknowledge.ts.
 */
export async function resolveDispatch(input: {
  dispatchId: string;
  decision: "not_published" | "published" | "release";
  reason: string;
  remoteId?: string;
  remoteUrl?: string;
}): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  const why = input.reason.trim();
  if (why.length < 3) return { ok: false, error: "Give a short reason - it is kept in the audit log" };
  const audit = { by: `admin:${admin.email}`, note: why };
  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(publicationDispatches)
      .where(eq(publicationDispatches.id, input.dispatchId))
      .for("update")
      .limit(1);
    if (!row) return "Delivery not found";
    if (input.decision === "release") {
      if (row.channel !== "plugin" || !(UNACKNOWLEDGED as readonly string[]).includes(row.status)) {
        return "Only an expired plugin hand-over can be released";
      }
      await tx
        .update(publicationDispatches)
        .set({ status: "released", reconciledBy: audit.by, reconciledAt: new Date(), reconcileNote: why.slice(0, 500), completedAt: new Date() })
        .where(eq(publicationDispatches.id, row.id));
    } else if (row.status !== "uncertain") {
      return "Only an uncertain send can be resolved this way";
    } else if (input.decision === "not_published") {
      await reconcileUncertain(row.id, { status: "failed", error: "Confirmed not on the site by an operator" }, audit, tx);
      await tx.update(articles).set({ error: null, updatedAt: new Date() }).where(eq(articles.id, row.articleId));
    } else {
      const remoteId = (input.remoteId ?? "").trim();
      const remoteUrl = (input.remoteUrl ?? "").trim();
      if (!/^\d+$/.test(remoteId) || !/^https?:\/\//.test(remoteUrl)) return "Give the post's id and its address";
      await reconcileUncertain(row.id, { status: "sent", remoteId, remoteUrl }, audit, tx);
      await tx
        .insert(publishLogs)
        .values({ articleId: row.articleId, integrationId: row.integrationId, dispatchId: row.id, status: "published", remoteId, remoteUrl })
        .onConflictDoNothing();
    }
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "publication.dispatch_resolved",
        targetType: "publication_dispatch",
        targetId: row.id,
        summary: `${input.decision} for article ${row.articleId}: ${why}`,
        detail: { decision: input.decision, reason: why, previousStatus: row.status, remoteId: input.remoteId ?? null, remoteUrl: input.remoteUrl ?? null },
      },
      tx,
    );
    return null;
  });
  if (outcome) return { ok: false, error: outcome };
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
