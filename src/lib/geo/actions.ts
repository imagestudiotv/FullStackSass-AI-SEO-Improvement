"use server";

import { and, desc, eq, inArray, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { isAiConfigured } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { geoPrompts, geoResults } from "@/lib/db/schema";
import { summarise } from "@/lib/geo/score";
import { maxPromptsFor } from "@/lib/geo/allowance";
import { cleanPrompt, suggestQuestions } from "@/lib/geo/suggest";
import { weeklyCheckRule } from "@/lib/geo/check-limits";
import { regenerateQuestions } from "@/lib/geo/regenerate";
import {
  MAX_PROMPT_LENGTH,
  REGENERATE_FAILED_ERROR,
  REGENERATE_LIMIT_ERROR,
  WEEKLY_CAP_ERROR,
  type GeoOverview,
  type GeoPromptView,
} from "@/lib/geo/shared";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import type { ActionResult } from "@/lib/websites/actions";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { reserveAndQueue } from "@/lib/jobs/outbox";
import { calendarMonth } from "@/lib/billing/entitlement-period";
import { FREE_PLAN, freePlanMessage } from "@/lib/plans/free-plan";
import { freePlanSnapshotsThisMonth, isFreePlanWebsite } from "@/lib/plans/free-plan-server";

/** Tracked questions quoted back to the model; the largest plan tracks 50. */
const MAX_EXISTING_SENT = 60;

/**
 * Visibility checks a user may start. A check is one model call per prompt
 * per engine - up to a hundred for the largest plan - so two an hour per
 * website, and ten per paying workspace, over sliding windows. The weekly
 * scheduled check is not counted here; it re-checks entitlement per call.
 */
const GEO_CHECKS_PER_WEBSITE_PER_HOUR = 2;
const GEO_CHECKS_PER_WORKSPACE_PER_HOUR = 10;

/**
 * GEO server actions.
 *
 * Every entry point goes through requireWebsite(), which scopes to the caller's
 * organisation and throws a not-found for anything outside it. GEO data names
 * a business's competitors, so leaking it across tenants would be a real
 * disclosure rather than a cosmetic bug.
 */

/**
 * How far apart two results may be and still count as the same run.
 *
 * A check of twenty prompts is forty model calls and takes minutes, so rows
 * from one run are spread out; runs themselves are days or weeks apart on the
 * weekly cron. An hour separates the two cases with room to spare.
 */
const RUN_GAP_MS = 60 * 60 * 1000;

/**
 * The results belonging to the run before the most recent one.
 *
 * `rows` must be newest first. Walks forward to the first gap larger than
 * RUN_GAP_MS (the end of the latest run), then collects until the next gap.
 */
function rowsBeforeLatestRun<T extends { checkedAt: Date }>(rows: T[]): T[] {
  let cut = -1;
  for (let i = 1; i < rows.length; i += 1) {
    const gap = rows[i - 1].checkedAt.getTime() - rows[i].checkedAt.getTime();
    if (gap > RUN_GAP_MS) {
      cut = i;
      break;
    }
  }
  if (cut === -1) return [];

  const previous: T[] = [];
  for (let i = cut; i < rows.length; i += 1) {
    if (i > cut) {
      const gap = rows[i - 1].checkedAt.getTime() - rows[i].checkedAt.getTime();
      if (gap > RUN_GAP_MS) break;
    }
    previous.push(rows[i]);
  }
  return previous;
}

/** A stored row as the score reads it: its share of answers, or one answer for an older row. */
function scored(r: typeof geoResults.$inferSelect) {
  return {
    mentioned: r.mentioned,
    position: r.position,
    competitors: r.competitors ?? [],
    excerpt: r.excerpt,
    cited: r.cited,
    samples: r.samples,
    mentionCount: r.mentionCount,
    weight: r.weight,
    averagePosition: r.averagePosition,
  };
}

/**
 * Overview for the panel: the score, and every tracked prompt with its most
 * recent result.
 *
 * Only the latest run feeds the score. Mixing runs would average away exactly
 * the change the customer is paying to notice.
 */
export async function getGeoOverview(websiteId: string): Promise<GeoOverview> {
  const { site } = await requireWebsite(websiteId);

  const tracked = await db
    .select()
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id))
    .orderBy(desc(geoPrompts.createdAt));

  if (tracked.length === 0) {
    return {
      score: 0,
      mentions: 0,
      total: 0,
      answers: 0,
      answersNamed: 0,
      averagePosition: null,
      topCompetitors: [],
      prompts: [],
      lastCheckedAt: null,
      previousScore: null,
    };
  }

  /**
   * All results for these prompts, newest first, then reduced to one per
   * prompt in code. Postgres DISTINCT ON would do this in the query, but the
   * row counts here are small (prompts are capped at 20) and the readable
   * version is easier to keep correct.
   */
  const rows = await db
    .select()
    .from(geoResults)
    .where(
      inArray(
        geoResults.geoPromptId,
        tracked.map((p) => p.id),
      ),
    )
    .orderBy(desc(geoResults.checkedAt));

  const latestByPrompt = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByPrompt.has(row.geoPromptId)) {
      latestByPrompt.set(row.geoPromptId, row);
    }
  }

  const prompts: GeoPromptView[] = tracked.map((p) => {
    const latest = latestByPrompt.get(p.id);
    return {
      id: p.id,
      prompt: p.prompt,
      isSuggested: p.isSuggested,
      active: p.active,
      language: p.language,
      latest: latest
        ? {
            mentioned: latest.mentioned,
            position: latest.position,
            excerpt: latest.excerpt,
            checkedAt: latest.checkedAt,
            samples: latest.samples ?? 1,
            mentionCount: latest.mentionCount ?? (latest.mentioned ? 1 : 0),
            averagePosition: latest.averagePosition ?? (latest.mentioned ? latest.position : null),
          }
        : null,
    };
  });

  /**
   * Scored over checked prompts only. Counting a never-checked prompt as a
   * miss would show a customer a low score built partly from questions we
   * never asked.
   */
  const checked = [...latestByPrompt.values()];
  const summary = summarise(checked.map(scored));

  /**
   * The run before this one, scored the same way.
   *
   * Checks are queued together, so a "run" is a cluster of rows written within
   * a few minutes of each other rather than a stored batch id. Rows are split
   * on the first gap longer than RUN_GAP_MS, walking the already-sorted list —
   * no extra query, and no schema change to record something the timestamps
   * already imply.
   *
   * Null unless the previous run actually checked something, so a website
   * checked once shows a score with no change indicator rather than a rise
   * from zero it never had.
   */
  const previousRun = rowsBeforeLatestRun(rows);
  const previousScore =
    previousRun.length > 0
      ? summarise(previousRun.map(scored)).score
      : null;

  return {
    ...summary,
    prompts,
    lastCheckedAt: rows[0]?.checkedAt ?? null,
    previousScore,
  };
}

export async function addGeoPrompt(
  websiteId: string,
  prompt: string,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const cleaned = cleanPrompt(prompt);
  if (!cleaned) {
    return { ok: false, error: "Write a question of at least a few words" };
  }

  const [{ count }] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id));

  /*
    The allowance is per PLAN now — 20 on Grow, 50 on Scale — so the limit is
    read from the subscription paying for this site rather than being one
    number for everybody.
  */
  const allowance = await maxPromptsFor(site.id);
  if (count >= allowance) {
    return {
      ok: false,
      error: `Your plan tracks up to ${allowance} questions. Remove one to add another.`,
    };
  }

  try {
    const [row] = await db
      .insert(geoPrompts)
      .values({ websiteId: site.id, prompt: cleaned, isSuggested: false })
      .returning({ id: geoPrompts.id });

    revalidatePath(`/websites/${site.id}/ai-visibility`);
    return { ok: true, data: { id: row.id } };
  } catch {
    // The unique index on (website, prompt) is the only realistic failure.
    return { ok: false, error: "You are already tracking that question" };
  }
}

export async function removeGeoPrompt(
  websiteId: string,
  promptId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  // Scoped by website as well as id, so an id from another tenant deletes
  // nothing rather than deleting someone else's prompt.
  await db
    .delete(geoPrompts)
    .where(and(eq(geoPrompts.id, promptId), eq(geoPrompts.websiteId, site.id)));

  revalidatePath(`/websites/${site.id}/ai-visibility`);
  return { ok: true, data: null };
}

/**
 * Queues a check of every active prompt.
 *
 * Runs through Inngest rather than inline: each prompt is two model calls, so
 * twenty prompts would far exceed a server action's budget and the customer
 * would watch a spinner until it timed out.
 */
export async function runGeoCheck(
  websiteId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured on this deployment" };
  }

  const [any] = await db
    .select({ id: geoPrompts.id })
    .from(geoPrompts)
    .where(and(eq(geoPrompts.websiteId, site.id), eq(geoPrompts.active, true)))
    .limit(1);

  if (!any) {
    return { ok: false, error: "Add a question first" };
  }

  /*
    Entitlement, not just ownership. This queues a job that spends money, and
    a server action is a public endpoint - the page in front of it redirects
    an unpaid customer, but the action behind it is still POSTable.
  */
  // The Free plan's AI visibility snapshot is allowed too, FREE_PLAN.visibilitySnapshotsPerMonth a month (below).
  const entitled = await isEntitledToSpend(site.id, { free: true });
  if (!entitled.ok) return { ok: false, error: entitled.error };
  const free = await isFreePlanWebsite(site.id);
  if (free && (await freePlanSnapshotsThisMonth(site.id)) >= FREE_PLAN.visibilitySnapshotsPerMonth) {
    return { ok: false, error: freePlanMessage("snapshotUsed") };
  }

  /*
    Reserved before queueing, atomically: the previous limit counted
    geo_results rows, which a check writes only as it finishes, so presses
    arriving together all counted the same zero. Billed to the owner.
  */
  const ownerOrgId = site.organizationId;
  const slot = await reserveAndQueue(
    [
      {
        key: `geo-check:site:${site.id}`,
        limit: GEO_CHECKS_PER_WEBSITE_PER_HOUR,
        window: { seconds: 60 * 60 },
      },
      {
        key: `geo-check:org:${ownerOrgId}`,
        limit: GEO_CHECKS_PER_WORKSPACE_PER_HOUR,
        window: { seconds: 60 * 60 },
      },
      // At most a few checks a week, the Monday run included (lib/geo/check-limits.ts).
      weeklyCheckRule(site.id),
      // Free: its one snapshot this month, so two presses cannot both take it.
      ...(free ? [{ key: `free-plan:geo:${site.id}`, limit: FREE_PLAN.visibilitySnapshotsPerMonth, window: { since: calendarMonth().start } }] : []),
    ],
    { operation: "geo.check", organizationId: ownerOrgId, websiteId: site.id },
    // Recorded with the slot; delivered now or retried (lib/jobs/outbox.ts).
    (reservations) => ({
      id: `geo-check:${reservations[0].id}`,
      name: "geo/check.requested",
      data: { websiteId: site.id, organizationId: ownerOrgId, reservations },
    }),
  );
  if (!slot.ok) {
    if (slot.rule?.key.startsWith("geo-check:week:")) {
      return { ok: false, error: WEEKLY_CAP_ERROR };
    }
    return {
      ok: false,
      error:
        "You have checked AI visibility several times in the last hour. Please try again shortly.",
    };
  }

  return { ok: true, data: null };
}

/**
 * Proposes questions a real customer might ask.
 *
 * The quality of this feature rests on the questions being ones people
 * actually type. Left to invent their own, customers write brand-first
 * questions ("is Bright Smile good?") which an assistant answers from the
 * premise — the brand is in the question, so it appears in the answer, and the
 * measurement is meaningless. Suggestions are deliberately brand-free.
 */
export async function suggestGeoPrompts(
  websiteId: string,
  /**
   * How many to ask for. Defaults to the old six, which is what the "suggest
   * more" button wants; filling an empty account asks for a plan's worth.
   */
  wanted = 6,
  /**
   * Questions already on the list, so the model is told not to repeat them.
   * Without this, "suggest more" reliably returns near-duplicates of what is
   * already there and the button appears to do nothing.
   */
  existing: string[] = [],
): Promise<ActionResult<string[]>> {
  /*
    A paid model call, so it is guarded like every other spend: an editor, on
    a website with a live plan, within an hourly allowance. It used to need
    only read access - a viewer, or a cancelled customer, could call it in a
    loop - and it took `wanted` and `existing` from the client unchecked,
    both of which size the prompt that is paid for.
  */
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured on this deployment" };
  }

  // Free too: its snapshot needs questions to ask (a few, maxPromptsFor).
  const entitled = await isEntitledToSpend(site.id, { free: true });
  if (!entitled.ok) return { ok: false, error: entitled.error };

  const allowance = await maxPromptsFor(site.id);
  const count = Number.isInteger(wanted)
    ? Math.min(Math.max(wanted, 1), Math.max(allowance, 1))
    : 6;
  const tracked = (Array.isArray(existing) ? existing : [])
    .filter((e): e is string => typeof e === "string")
    .slice(0, MAX_EXISTING_SENT)
    .map((e) => e.slice(0, MAX_PROMPT_LENGTH));

  const suggested = await suggestQuestions({ site, count, tracked });
  if (suggested.ok) return { ok: true, data: suggested.questions };
  return {
    ok: false,
    error:
      suggested.reason === "limited"
        ? "You have asked for suggestions many times this hour. Please try again shortly."
        : "Could not suggest questions. Try again.",
  };
}

/**
 * Writes the website's questions again, in its article language and from
 * its content plan (lib/geo/regenerate.ts). Keeps the questions the customer
 * typed unless `replaceAll`. Uses no question allowance: what it writes
 * replaces what was suggested before.
 */
export async function regenerateGeoPrompts(
  websiteId: string,
  replaceAll = false,
): Promise<ActionResult<{ added: number; removed: number }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured on this deployment" };
  }
  const entitled = await isEntitledToSpend(site.id, { free: true });
  if (!entitled.ok) return { ok: false, error: entitled.error };

  const outcome = await regenerateQuestions(site.id, { replaceAll: replaceAll === true, reason: "manual" });
  revalidatePath(`/websites/${site.id}/ai-visibility`);
  if (outcome.ok) return { ok: true, data: { added: outcome.added, removed: outcome.removed } };
  return { ok: false, error: outcome.reason === "limited" ? REGENERATE_LIMIT_ERROR : REGENERATE_FAILED_ERROR };
}
