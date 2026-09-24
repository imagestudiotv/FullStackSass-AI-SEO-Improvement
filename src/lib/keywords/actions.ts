"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import { db } from "@/lib/db";
import { calendarItems, clusters, keywords } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import { withinRateLimit } from "@/lib/billing/rate-limit";
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

/** Starts (or re-runs) keyword research for a website. */
export async function startResearch(
  websiteId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site, orgId } = guard.context;

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
  const rate = await withinRateLimit(orgId, "seo_api");
  if (!rate.ok) return { ok: false, error: rate.error };

  await queueJob({
    name: "website/research.requested",
    data: { websiteId: site.id, organizationId: orgId },
  });

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
  ActionResult<{ added: number; skipped: number; replanned: boolean }>
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
  if (inserted.length > 0) {
    const rate = await withinRateLimit(guard.context.orgId, "seo_api");
    if (rate.ok) {
      replanned = await queueJob({
        name: "website/research.requested",
        data: { websiteId: site.id, organizationId: guard.context.orgId },
      });
    }
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
