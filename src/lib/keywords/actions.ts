"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { calendarItems, clusters, keywords, websites } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import { reserveAndQueue } from "@/lib/jobs/outbox";
import { researchInFlight } from "@/lib/keywords/research-state";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Keyword and content-plan reads and actions.
 *
 * Every entry point goes through requireWebsite(), which scopes the id to the
 * caller's organization and 404s anything else. A server action is a public
 * endpoint; the website id in the argument is attacker-controlled.
 */

export type KeywordRow = {
  id: string;
  term: string;
  volume: number | null;
  difficulty: number | null;
  cpc: string | null;
  intent: string | null;
  priorityScore: number | null;
  clusterName: string | null;
};

export async function listKeywords(websiteId: string): Promise<KeywordRow[]> {
  const { site } = await requireWebsite(websiteId);
  return db
    .select({
      id: keywords.id,
      term: keywords.term,
      volume: keywords.volume,
      difficulty: keywords.difficulty,
      cpc: keywords.cpc,
      intent: keywords.intent,
      priorityScore: keywords.priorityScore,
      clusterName: clusters.name,
    })
    .from(keywords)
    .leftJoin(clusters, eq(keywords.clusterId, clusters.id))
    .where(eq(keywords.websiteId, site.id))
    .orderBy(desc(keywords.priorityScore));
}

export type CalendarRow = {
  id: string;
  title: string;
  targetKeyword: string | null;
  intent: string | null;
  scheduledFor: Date | null;
  status: string;
  customInstructions: string | null;
  clusterName: string | null;
  /**
   * Difficulty and volume for the target keyword, shown on upcoming items so
   * someone can see why a topic was chosen before it is written. Null when the
   * keyword is not one we researched — a title typed by hand has no metrics.
   */
  difficulty: number | null;
  volume: number | null;
};

export async function listCalendar(websiteId: string): Promise<CalendarRow[]> {
  const { site } = await requireWebsite(websiteId);
  return (
    db
      .select({
        id: calendarItems.id,
        title: calendarItems.title,
        targetKeyword: calendarItems.targetKeyword,
        intent: calendarItems.intent,
        scheduledFor: calendarItems.scheduledFor,
        status: calendarItems.status,
        customInstructions: calendarItems.customInstructions,
        clusterName: clusters.name,
        difficulty: keywords.difficulty,
        volume: keywords.volume,
      })
      .from(calendarItems)
      .leftJoin(clusters, eq(calendarItems.clusterId, clusters.id))
      /**
       * Metrics come from the keyword row, matched on the term. A left join so
       * an item whose keyword was since deleted still appears — losing a planned
       * article because its keyword row went away would be worse than showing it
       * without numbers.
       */
      .leftJoin(
        keywords,
        and(
          eq(keywords.websiteId, calendarItems.websiteId),
          eq(keywords.term, calendarItems.targetKeyword),
        ),
      )
      .where(eq(calendarItems.websiteId, site.id))
      .orderBy(asc(calendarItems.scheduledFor))
  );
}

/**
 * Research runs a user may start, over sliding hours. Each is three model
 * calls plus provider lookups billed per row, and re-running minutes apart
 * produces the same clusters. Reserved atomically before queueing and billed
 * to the website's owner.
 */
const RESEARCH_PER_WEBSITE_PER_HOUR = 3;
const RESEARCH_PER_WORKSPACE_PER_HOUR = 6;

/**
 * Reserves a research run and records its job in one transaction (lib/jobs/
 * outbox.ts), and marks the website "researching" in that same transaction.
 *
 * "queued", or "limited" when the hourly allowance is used up (a queue outage
 * delays the run, it does not refuse it), or - with refuseIfRunning - "running"
 * when a run is already under way, in which case nothing is reserved.
 *
 * WHY THE STATUS IS WRITTEN HERE. The job sets it too, but only once its
 * first step runs, seconds after the button's own refresh. The page rendered
 * "ready" in that gap, so it never followed the run: the plan appeared only on
 * a manual reload, and pressing again was the natural thing to do (client,
 * 2026-10-02). Written before the job is sent, so even a run that finishes
 * at once cannot be overtaken by it. A website still being analysed keeps
 * that status.
 */
async function startResearchJob(
  websiteId: string,
  ownerOrgId: string,
  options: { refuseIfRunning?: boolean } = {},
): Promise<"queued" | "running" | "limited"> {
  /*
    A run in flight answers first, before the hourly allowance: with the
    allowance used up, a press during the third run of the hour was told "too
    many times" and its page never followed the run. Checked again under the
    lock below, for presses that race.
  */
  if (options.refuseIfRunning) {
    const [site] = await db
      .select({ status: websites.status, updatedAt: websites.updatedAt })
      .from(websites)
      .where(eq(websites.id, websiteId))
      .limit(1);
    if (site && researchInFlight(site)) return "running";
  }

  const slot = await reserveAndQueue(
    [
      { key: `research:site:${websiteId}`, limit: RESEARCH_PER_WEBSITE_PER_HOUR, window: { seconds: 3600 } },
      { key: `research:org:${ownerOrgId}`, limit: RESEARCH_PER_WORKSPACE_PER_HOUR, window: { seconds: 3600 } },
    ],
    { operation: "keywords.research", organizationId: ownerOrgId, websiteId },
    (reservations) => ({
      id: `website-research:${reservations[0].id}`,
      name: "website/research.requested",
      data: { websiteId, organizationId: ownerOrgId, reservations },
    }),
    async (tx) => {
      // Locked, so two presses at once see each other: the second finds the first running.
      const [site] = await tx
        .select({ status: websites.status, updatedAt: websites.updatedAt })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .for("update");
      if (!site) return false;
      if (options.refuseIfRunning && researchInFlight(site)) return false;
      if (site.status !== "pending" && site.status !== "crawling") {
        await tx
          .update(websites)
          .set({ status: "researching", updatedAt: new Date() })
          .where(eq(websites.id, websiteId));
      }
      return true;
    },
  );
  if (slot.ok) return "queued";
  return "refused" in slot && slot.refused ? "running" : "limited";
}

/** Starts (or re-runs) keyword research for a website. */
export async function startResearch(
  websiteId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  // Billed to the website's owner, not an invited editor's own workspace.
  const ownerOrgId = site.organizationId;

  // Research reads the extracted profile; without it the seeds would be
  // generated from nothing and the model call wasted.
  if (site.status === "pending" || site.status === "crawling") {
    return { ok: false, error: "Wait until the site has been analysed first" };
  }

  /**
   * REFUSE BEFORE SPENDING, not after.
   *
   * Research bills three model calls — seeds, clustering, calendar — before
   * it reaches the step that stores anything. A website with no subscription
   * used to pay for all three and then store nothing, because the keyword
   * allowance came back as zero. The job still runs that check as a backstop,
   * but by then the money is gone.
   *
   * Checked here, where a refusal costs nothing and the message can send the
   * customer somewhere useful.
   */
  const entitlement = await checkLimit(site.id, "keywords");
  if (
    entitlement.reason === "no_active_plan" ||
    entitlement.reason === "subscription_inactive"
  ) {
    return {
      ok: false,
      error: "Choose a plan for this website before building its content plan",
    };
  }

  /*
    Three model calls plus provider lookups every run, and re-running research
    on the same site minutes apart produces the same clusters. Counted on
    seo_api, which research-keywords records once per billable provider call.
  */
  /*
    A press while a run is under way - a double click, a second tab - is the
    same request again: nothing more is queued or billed, and the page goes on
    following the run already going.
  */
  const queued = await startResearchJob(site.id, ownerOrgId, { refuseIfRunning: true });
  if (queued === "limited") {
    return {
      ok: false,
      error: "You have run this many times in the last hour. Please try again shortly.",
    };
  }

  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}

export async function updateCalendarItem(
  websiteId: string,
  itemId: string,
  input: {
    title?: string;
    scheduledFor?: string | null;
    /** Free-text steer for this one article; the generator already reads it. */
    customInstructions?: string | null;
  },
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Title cannot be empty" };
    patch.title = title.slice(0, 200);
  }
  if (input.scheduledFor !== undefined) {
    patch.scheduledFor = input.scheduledFor
      ? new Date(input.scheduledFor)
      : null;
  }
  if (input.customInstructions !== undefined) {
    const note = input.customInstructions?.trim();
    patch.customInstructions = note ? note.slice(0, 1000) : null;
  }

  // Scoped by websiteId as well as id: without it, a valid item id from
  // another tenant would be editable through a website this caller does own.
  await db
    .update(calendarItems)
    .set(patch)
    .where(
      and(eq(calendarItems.id, itemId), eq(calendarItems.websiteId, site.id)),
    );

  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}

export async function deleteCalendarItem(
  websiteId: string,
  itemId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  await db
    .delete(calendarItems)
    .where(
      and(eq(calendarItems.id, itemId), eq(calendarItems.websiteId, site.id)),
    );

  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}

/** How many terms one submission may add. */
const MAX_PER_SUBMISSION = 50;

/** Longest a single keyword may be. */
const MAX_TERM_LENGTH = 120;

/**
 * Adds keywords the customer typed themselves.
 *
 * WHY THIS EXISTS: research is the only way terms got into the table, and
 * what it finds is the ceiling on everything downstream — the clusters are
 * built from the keywords, and the content calendar is built from the
 * clusters. A niche business whose research returned thirty terms therefore
 * got a calendar far smaller than the plan it bought, with no way to say "you
 * have missed the phrase my customers actually search for".
 *
 * The owner usually knows those phrases. This lets them say so.
 *
 * Added terms carry no volume, difficulty or CPC: those come from the SEO
 * provider, and inventing them would put numbers on screen that nothing
 * measured. They are left null and the table shows a dash, which is honest
 * and still lets the term reach clustering — which reads the text, not the
 * metrics.
 *
 * `source: "manual"` distinguishes them from "ai_seed" for support, and
 * because re-running research must not silently delete work somebody typed.
 */
export async function addKeywords(
  websiteId: string,
  /** One per line, or comma-separated — people paste both. */
  input: string,
): Promise<
  ActionResult<{ added: number; skipped: number; replanned: boolean; planBusy: boolean }>
> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  /*
    Split on newlines AND commas: a customer pasting from a spreadsheet gets
    one per line, one pasting from a sentence gets commas, and neither should
    have to reformat. Lowercased so "Wedding Videographer" and "wedding
    videographer" cannot both be stored — the unique index is case-sensitive
    and would happily take both.
  */
  const terms = Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((term) => term.trim().toLowerCase().replace(/\s+/g, " "))
        .filter((term) => term.length > 0 && term.length <= MAX_TERM_LENGTH),
    ),
  );

  if (terms.length === 0) {
    return { ok: false, error: "Type at least one keyword" };
  }
  if (terms.length > MAX_PER_SUBMISSION) {
    return {
      ok: false,
      error: `Add up to ${MAX_PER_SUBMISSION} keywords at a time. You pasted ${terms.length}.`,
    };
  }

  /**
   * The plan's keyword allowance, counted the same way research counts it.
   *
   * Typing is a way into the same table, so it has to respect the same cap —
   * otherwise the limit only applies to the path that happens to be
   * automated, and a plan's headline number means nothing.
   */
  const limit = await checkLimit(site.id, "keywords");
  if (
    limit.reason === "no_active_plan" ||
    limit.reason === "subscription_inactive"
  ) {
    return {
      ok: false,
      error: "Choose a plan for this website before adding keywords",
    };
  }

  const room =
    limit.limit === UNLIMITED
      ? terms.length
      : Math.max(limit.limit - limit.used, 0);

  if (room === 0) {
    return {
      ok: false,
      error: `Your plan tracks ${limit.limit} keywords and you are using all of them. Remove some first.`,
    };
  }

  const accepted = terms.slice(0, room);

  /**
   * onConflictDoNothing, not an error.
   *
   * Research and the customer will name the same obvious phrases, and a
   * submission of ten terms where two already exist should add the eight —
   * not fail and make them work out which two. The count returned below says
   * what actually happened.
   */
  const inserted = await db
    .insert(keywords)
    .values(
      accepted.map((term) => ({
        websiteId: site.id,
        term,
        source: "manual",
      })),
    )
    .onConflictDoNothing({
      target: [keywords.websiteId, keywords.term],
    })
    .returning({ id: keywords.id });

  /**
   * Re-plan straight away, so adding a keyword does something visible.
   *
   * A term that is only stored changes nothing a customer can see: the topics
   * and the content plan are built by the research job, so without this they
   * would have to know to press Refresh afterwards — and the one instruction
   * a product should never rely on is "now go and press the other button".
   *
   * Queued ONCE per submission rather than per term, which is also why the
   * field takes a list: someone adding ten phrases triggers one run, not ten.
   *
   * Re-planning is safe. Keywords are upserted, so nothing typed is lost, and
   * save-calendar clears only items still "planned" — an article already
   * written or published survives untouched.
   *
   * A failure here is not a failure of the add. The keywords are already
   * stored, so the button reports success and the customer can press Refresh
   * themselves; throwing would tell them nothing happened when something did.
   */
  let replanned = false;
  /*
    While a plan is being built, a second run is not queued behind it: the
    first one's end would mark the site ready while the second still waited,
    and the page would stop following it. The keywords are stored either way;
    the customer presses Refresh once the current plan is in.
  */
  let planBusy = false;
  if (inserted.length > 0) {
    const outcome = await startResearchJob(site.id, site.organizationId, { refuseIfRunning: true });
    replanned = outcome === "queued";
    planBusy = outcome === "running";
  }

  revalidatePath(`/websites/${site.id}/content`);
  return {
    ok: true,
    data: {
      added: inserted.length,
      // Already present, over the plan's cap, or trimmed as duplicates.
      skipped: terms.length - inserted.length,
      /**
       * Whether the plan is rebuilding. False when nothing was added, or when
       * the hourly cap was reached — someone adding keywords in bursts should
       * still get their terms stored, and the UI says what to do next.
       */
      replanned,
      /** A plan was already being built, so none was queued; Refresh after it lands. */
      planBusy,
    },
  };
}

export async function deleteKeyword(
  websiteId: string,
  keywordId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  await db
    .delete(keywords)
    .where(and(eq(keywords.id, keywordId), eq(keywords.websiteId, site.id)));

  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}

/**
 * Whether the content plan exists yet.
 *
 * The onboarding step polls this rather than calling router.refresh() and
 * reading the server props again. refresh() clears the CLIENT cache but, per
 * Next's own docs, "does not invalidate the server-side cache" — and
 * startResearch only revalidates /websites/[id], so /onboarding/content kept
 * serving the copy rendered before the job wrote anything. The page sat on
 * "Building your content plan…" forever while the rows existed in the
 * database, which is exactly the "it never moves on" the client reported.
 *
 * A direct query cannot be stale, so this is the thing the UI trusts.
 */
export async function getResearchState(
  websiteId: string,
): Promise<ActionResult<{ hasKeywords: boolean; hasPlan: boolean }>> {
  const { site } = await requireWebsite(websiteId);

  // limit(1) on both: the question is "any?", not "how many?".
  const [keywordRow, planRow] = await Promise.all([
    db
      .select({ id: keywords.id })
      .from(keywords)
      .where(eq(keywords.websiteId, site.id))
      .limit(1),
    db
      .select({ id: calendarItems.id })
      .from(calendarItems)
      .where(eq(calendarItems.websiteId, site.id))
      .limit(1),
  ]);

  return {
    ok: true,
    data: {
      hasKeywords: keywordRow.length > 0,
      hasPlan: planRow.length > 0,
    },
  };
}
