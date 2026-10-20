import "server-only";

import { and, asc, eq, like, lt, or, sql } from "drizzle-orm";

import { recordAdminAction } from "@/lib/admin/audit";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { BlogPostError, cleanBlogPost, isUniqueViolation, RESERVED_SLUGS, type BlogPostInput } from "@/lib/blog/post-fields";
import { blogSlug } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogAutopilotRuns, blogAutopilotTopics, blogCategories, blogPosts } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import type { Locale } from "@/lib/i18n/config";
import { deliverNow, enqueueJob } from "@/lib/jobs/outbox";

/**
 * The blog autopilot's runs, in the database: taking the next topic, saving
 * what was written as a draft, and recording a run that failed. The writing
 * itself is lib/blog/autopilot/write.ts; the background job that joins them
 * is inngest/functions/blog-autopilot.ts.
 *
 * ONE ARTICLE AT A TIME. A topic is taken ("writing") in the same
 * transaction that records the run and the job, so the page shows it being
 * written at once, a second click is refused while it is, and a run is never
 * promised without a job behind it (lib/jobs/outbox.ts).
 */

export const RUN_EVENT = "blog/autopilot.run";

/** Who the autopilot's posts and log entries are by. */
export const AUTOPILOT_ACTOR = "Blog autopilot";

export type RunTrigger = "schedule" | "manual";

export type AutopilotClaim = {
  runId: string;
  topicId: string;
  topic: string;
  keyword: string | null;
  notes: string | null;
  /** When the topic was taken: the writer's "today", and the posts it may link to. */
  claimedAt: string;
};

export type ClaimOutcome =
  | { claimed: AutopilotClaim }
  /** busy: an article is being written; empty: no topic waits; done-today: that scheduled slot already ran today. */
  | { skipped: "busy" | "empty" | "done-today" };

/** Serialises the topic list: the same lock lib/admin/blog-autopilot.ts takes. */
const lockTopics = (tx: Executor) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('blog_autopilot_topics'))`);

/** The UTC day, as the runs table stores it. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Takes the next waiting topic and records its run and its job, all in one
 * transaction, then sends the job. Nothing is taken while another article is
 * being written.
 */
export async function startAutopilotRun(input: {
  trigger: RunTrigger;
  /** Which of the day's scheduled articles (1 when not given; a manual run is always 1). */
  slot?: number;
  /** The administrator who pressed "Write one now". */
  requestedBy?: string | null;
  /** Written in the same transaction, once the topic is taken: the admin log entry. */
  record?: (tx: Executor, claim: AutopilotClaim) => Promise<void>;
  now?: Date;
}): Promise<ClaimOutcome> {
  const now = input.now ?? new Date();
  const outcome = await db.transaction(async (tx): Promise<ClaimOutcome> => {
    await lockTopics(tx);
    const [busy] = await tx.select({ id: blogAutopilotTopics.id }).from(blogAutopilotTopics).where(eq(blogAutopilotTopics.status, "writing")).limit(1);
    if (busy) return { skipped: "busy" };
    const [next] = await tx
      .select()
      .from(blogAutopilotTopics)
      .where(eq(blogAutopilotTopics.status, "queued"))
      .orderBy(asc(blogAutopilotTopics.sortOrder), asc(blogAutopilotTopics.createdAt))
      .limit(1)
      .for("update");
    if (!next) return { skipped: "empty" };
    // A second scheduled run for the same day and slot stops here (the partial unique index); a manual one never clashes.
    const [run] = await tx
      .insert(blogAutopilotRuns)
      .values({
        runDate: utcDay(now),
        trigger: input.trigger,
        slot: input.trigger === "schedule" ? (input.slot ?? 1) : 1,
        topicId: next.id,
        status: "running",
        detail: input.requestedBy ? { requestedBy: input.requestedBy } : {},
        startedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: blogAutopilotRuns.id });
    if (!run) return { skipped: "done-today" };
    await tx.update(blogAutopilotTopics).set({ status: "writing", error: null, updatedAt: now }).where(eq(blogAutopilotTopics.id, next.id));
    await enqueueJob(tx, { id: `${RUN_EVENT}:${run.id}`, name: RUN_EVENT, data: { runId: run.id } });
    const claimed: AutopilotClaim = { runId: run.id, topicId: next.id, topic: next.topic, keyword: next.keyword, notes: next.notes, claimedAt: now.toISOString() };
    await input.record?.(tx, claimed);
    return { claimed };
  });
  // After commit. If it does not go out now, the outbox keeps trying.
  if ("claimed" in outcome) await deliverNow(`${RUN_EVENT}:${outcome.claimed.runId}`);
  return outcome;
}

/** The run's topic, while the run is still going; null once it has finished or failed. */
export async function loadClaim(runId: string, executor: Executor = db): Promise<AutopilotClaim | null> {
  const [row] = await executor
    .select({ run: blogAutopilotRuns, topic: blogAutopilotTopics })
    .from(blogAutopilotRuns)
    .innerJoin(blogAutopilotTopics, eq(blogAutopilotTopics.id, blogAutopilotRuns.topicId))
    .where(eq(blogAutopilotRuns.id, runId))
    .limit(1);
  if (!row || row.run.status !== "running" || row.topic.status !== "writing") return null;
  return {
    runId: row.run.id,
    topicId: row.topic.id,
    topic: row.topic.topic,
    keyword: row.topic.keyword,
    notes: row.topic.notes,
    claimedAt: row.run.startedAt.toISOString(),
  };
}

/** The first of slug, slug-2, slug-3... that no post uses (addresses are unique across languages). */
async function freeSlug(tx: Executor, slug: string): Promise<string> {
  const rows = await tx
    .select({ slug: blogPosts.slug })
    .from(blogPosts)
    .where(or(eq(blogPosts.slug, slug), like(blogPosts.slug, `${slug.replace(/[\\%_]/g, "\\$&")}-%`)));
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n += 1) if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
}

/**
 * Saves the English article as a draft - never published: an administrator
 * reads it and publishes it (client's choice 2). The run goes on (the
 * translations) and is closed by finishAutopilotRun. Saving twice (a retried
 * step) returns the post saved the first time.
 */
export async function saveAutopilotDraft(
  claim: AutopilotClaim,
  draft: BlogPostInput,
  report: Record<string, unknown>,
): Promise<{ postId: string; slug: string }> {
  // The same rules as a post an administrator saves; BlogPostError says what is wrong.
  const fields = cleanBlogPost(draft, true);
  return db.transaction(async (tx) => {
    const [run] = await tx.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId)).for("update");
    if (!run) throw new BlogPostError("The run no longer exists");
    if (run.postId) {
      const [post] = await tx.select({ slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.id, run.postId)).limit(1);
      if (post) return { postId: run.postId, slug: post.slug };
    }
    const [category] = await tx.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.name, fields.category)).for("share").limit(1);
    if (!category) throw new BlogPostError(`The category "${fields.category}" no longer exists`);
    const slug = await freeSlug(tx, fields.slug);
    const now = new Date();
    const [post] = await tx
      .insert(blogPosts)
      .values({
        ...fields,
        slug,
        locale: "en",
        status: "draft",
        createdBy: AUTOPILOT_ACTOR,
        updatedBy: AUTOPILOT_ACTOR,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: blogPosts.id });
    await recordAdminAction(
      {
        actorEmail: AUTOPILOT_ACTOR,
        action: "blog.post_created",
        targetType: "blog_post",
        targetId: post.id,
        summary: `The blog autopilot wrote the draft "${fields.title}"`,
        detail: { slug, topicId: claim.topicId, runId: claim.runId },
      },
      tx,
    );
    await tx.update(blogAutopilotTopics).set({ postId: post.id, updatedAt: now }).where(eq(blogAutopilotTopics.id, claim.topicId));
    await tx
      .update(blogAutopilotRuns)
      .set({ postId: post.id, detail: sql`${blogAutopilotRuns.detail} || ${JSON.stringify(report)}::jsonb` })
      .where(eq(blogAutopilotRuns.id, claim.runId));
    return { postId: post.id, slug };
  });
}

/** The English draft as saved (cleaned), for its translations; null once it is deleted. */
export async function loadDraft(postId: string) {
  const [post] = await db
    .select({
      title: blogPosts.title,
      seoTitle: blogPosts.seoTitle,
      description: blogPosts.description,
      shortAnswer: blogPosts.shortAnswer,
      breadcrumbLabel: blogPosts.breadcrumbLabel,
      primaryKeyword: blogPosts.primaryKeyword,
      secondaryKeywords: blogPosts.secondaryKeywords,
      bodyHtml: blogPosts.bodyHtml,
      faqs: blogPosts.faqs,
    })
    .from(blogPosts)
    .where(eq(blogPosts.id, postId))
    .limit(1);
  return post ?? null;
}

/**
 * Saves one translation of the run's English draft, as the editor's AI
 * translation would be (lib/admin/blog.ts createBlogTranslation): a draft
 * linked to the English post, marked "needs review" - it cannot be published
 * until an administrator ticks "reviewed by a native speaker" - with the
 * English post's category, author and sources, and an address of its own.
 * A language already translated returns that translation: a retried step
 * saves nothing twice.
 */
export async function saveAutopilotTranslation(
  sourceId: string,
  locale: Exclude<Locale, "en">,
  translated: Omit<BlogPostInput, "category" | "author" | "sources" | "locale">,
): Promise<{ postId: string; slug: string }> {
  const language = LANGUAGE_NAMES_EN[locale];
  const existing = async (executor: Executor) =>
    (
      await executor
        .select({ id: blogPosts.id, slug: blogPosts.slug })
        .from(blogPosts)
        .where(and(eq(blogPosts.translationOf, sourceId), eq(blogPosts.locale, locale)))
        .limit(1)
    )[0];
  try {
    return await db.transaction(async (tx) => {
      const [source] = await tx.select().from(blogPosts).where(eq(blogPosts.id, sourceId)).for("share").limit(1);
      if (!source) throw new BlogPostError("The English draft was deleted before its translations were saved");
      const already = await existing(tx);
      if (already) return { postId: already.id, slug: already.slug };
      const fields = cleanBlogPost(
        { ...translated, slug: blogSlug(translated.slug) || blogSlug(translated.title), category: source.category, author: source.author, sources: source.sources },
        true,
      );
      // The plain address, then with the language code, then numbered: never another post's.
      const candidates = [fields.slug, `${fields.slug}-${locale}`, ...[2, 3, 4, 5].map((n) => `${fields.slug}-${locale}-${n}`)];
      let slug: string | null = null;
      for (const candidate of candidates) {
        const [taken] = await tx.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, candidate)).limit(1);
        if (!taken && !RESERVED_SLUGS.has(candidate)) {
          slug = candidate;
          break;
        }
      }
      if (!slug) throw new BlogPostError(`Every address tried for the ${language} translation is taken`);
      const now = new Date();
      const [row] = await tx
        .insert(blogPosts)
        .values({
          ...fields,
          slug,
          locale,
          translationOf: source.id,
          needsReview: true,
          status: "draft",
          createdBy: AUTOPILOT_ACTOR,
          updatedBy: AUTOPILOT_ACTOR,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: blogPosts.id });
      await recordAdminAction(
        {
          actorEmail: AUTOPILOT_ACTOR,
          action: "blog.translation_created",
          targetType: "blog_post",
          targetId: row.id,
          summary: `The blog autopilot wrote the ${language} draft of "${source.title}"`,
          detail: { source: source.id, locale, mode: "autopilot", slug },
        },
        tx,
      );
      return { postId: row.id, slug };
    });
  } catch (error) {
    // Saved at the same moment by an administrator's own "Translate": theirs is the translation.
    if (isUniqueViolation(error)) {
      const other = await existing(db);
      if (other) return { postId: other.id, slug: other.slug };
    }
    throw error;
  }
}

/** Closes a run whose English draft is saved: the run is done and its topic written. Closing twice changes nothing. */
export async function finishAutopilotRun(claim: Pick<AutopilotClaim, "runId" | "topicId">, report: Record<string, unknown> = {}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [run] = await tx
      .update(blogAutopilotRuns)
      .set({ status: "done", finishedAt: now, detail: sql`${blogAutopilotRuns.detail} || ${JSON.stringify(report)}::jsonb` })
      .where(and(eq(blogAutopilotRuns.id, claim.runId), eq(blogAutopilotRuns.status, "running")))
      .returning({ postId: blogAutopilotRuns.postId });
    if (!run) return;
    await tx
      .update(blogAutopilotTopics)
      .set({ status: "written", postId: run.postId, error: null, writtenAt: now, updatedAt: now })
      .where(and(eq(blogAutopilotTopics.id, claim.topicId), eq(blogAutopilotTopics.status, "writing")));
  });
}

/**
 * Records a run that could not finish: the run is marked failed with the
 * reason. Its topic is failed too - "Try again" puts it back in the queue -
 * unless its English draft was already saved: then the topic is written
 * (trying again would write the article twice) and the draft is kept.
 * A run already finished is left alone.
 */
export async function failAutopilotRun(runId: string, reason: string, executor: Executor = db): Promise<void> {
  const error = reason.replace(/\s+/g, " ").trim().slice(0, 500) || "The article could not be written";
  const now = new Date();
  await executor.transaction(async (tx) => {
    const [run] = await tx
      .update(blogAutopilotRuns)
      .set({ status: "failed", error, finishedAt: now })
      .where(and(eq(blogAutopilotRuns.id, runId), eq(blogAutopilotRuns.status, "running")))
      .returning({ topicId: blogAutopilotRuns.topicId, postId: blogAutopilotRuns.postId });
    if (!run?.topicId) return;
    await tx
      .update(blogAutopilotTopics)
      .set(run.postId ? { status: "written", postId: run.postId, writtenAt: now, updatedAt: now } : { status: "failed", error, updatedAt: now })
      .where(and(eq(blogAutopilotTopics.id, run.topicId), eq(blogAutopilotTopics.status, "writing")));
  });
}

/**
 * What one step paid for AI, kept with the run under the step's name: set,
 * not added, so a retried step is never counted twice. The run's cost is
 * the sum (lib/admin/blog-autopilot.ts).
 */
export async function noteCost(runId: string, step: string, usd: number, executor: Executor = db): Promise<void> {
  const value = Math.round(Math.max(0, usd) * 10_000) / 10_000;
  await executor
    .update(blogAutopilotRuns)
    .set({
      detail: sql`jsonb_set(case when ${blogAutopilotRuns.detail} ? 'costs' then ${blogAutopilotRuns.detail} else ${blogAutopilotRuns.detail} || '{"costs": {}}'::jsonb end, array['costs', ${step}]::text[], to_jsonb(${value}::numeric))`,
    })
    .where(eq(blogAutopilotRuns.id, runId));
}

/** What the run's AI cost so far: the sum of its steps' costs (noteCost), or null before any. */
export async function runCost(runId: string, executor: Executor = db): Promise<number | null> {
  const [run] = await executor.select({ detail: blogAutopilotRuns.detail }).from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, runId)).limit(1);
  const costs = Object.values((run?.detail.costs ?? {}) as Record<string, unknown>).map(Number).filter(Number.isFinite);
  return costs.length ? Math.round(costs.reduce((total, usd) => total + usd, 0) * 100) / 100 : null;
}

/** Adds what a step found (costs, warnings, picture ideas...) to the run's record. */
export async function noteRun(runId: string, detail: Record<string, unknown>, executor: Executor = db): Promise<void> {
  await executor
    .update(blogAutopilotRuns)
    .set({ detail: sql`${blogAutopilotRuns.detail} || ${JSON.stringify(detail)}::jsonb` })
    .where(eq(blogAutopilotRuns.id, runId));
}

/** A run still "running" after this long has stopped for good (every step is minutes; the whole run under an hour). */
export const STALE_RUN_HOURS = 3;

/**
 * Fails runs that stopped without finishing - a job lost by the queue, a
 * deployment that dropped it - so their topic can be tried again and
 * "Write the next one now" is not blocked for ever. Returns how many.
 */
export async function failStaleRuns(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - STALE_RUN_HOURS * 3600_000);
  const stale = await db
    .select({ id: blogAutopilotRuns.id })
    .from(blogAutopilotRuns)
    .where(and(eq(blogAutopilotRuns.status, "running"), lt(blogAutopilotRuns.startedAt, before)));
  for (const run of stale) await failAutopilotRun(run.id, "The writing stopped without finishing. Try again.");
  return stale.length;
}

/**
 * The day's scheduled runs so far (written, failed or skipped), and whether
 * the schedule stopped for the day because there was nothing to write.
 */
export async function scheduledRunsToday(runDate: string): Promise<{ count: number; stopped: boolean }> {
  const runs = await db
    .select({ topicId: blogAutopilotRuns.topicId })
    .from(blogAutopilotRuns)
    .where(and(eq(blogAutopilotRuns.runDate, runDate), eq(blogAutopilotRuns.trigger, "schedule")));
  // A day recorded with nothing to write (recordEmptyDay) has a run without a topic.
  return { count: runs.length, stopped: runs.some((run) => run.topicId === null) };
}

/**
 * Records that the schedule had nothing (more) to write today, once, in the
 * day's next slot: it shows on the autopilot page with the reason, and the
 * schedule does not try again every hour that day.
 */
export async function recordEmptyDay(runDate: string, reason: string, now: Date = new Date(), slot = 1): Promise<void> {
  await db
    .insert(blogAutopilotRuns)
    .values({ runDate, trigger: "schedule", slot, status: "failed", error: reason.slice(0, 500), startedAt: now, finishedAt: now })
    .onConflictDoNothing();
}
