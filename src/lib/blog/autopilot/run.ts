import "server-only";

import { and, asc, eq, like, or, sql } from "drizzle-orm";

import { recordAdminAction } from "@/lib/admin/audit";
import { BlogPostError, cleanBlogPost, type BlogPostInput } from "@/lib/blog/post-fields";
import { db } from "@/lib/db";
import { blogAutopilotRuns, blogAutopilotTopics, blogCategories, blogPosts } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
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
  /** busy: an article is being written; empty: no topic waits; done-today: the day's scheduled run exists. */
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
    // A second scheduled run for the same day stops here (the partial unique index); a manual one never clashes.
    const [run] = await tx
      .insert(blogAutopilotRuns)
      .values({
        runDate: utcDay(now),
        trigger: input.trigger,
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
 * reads it and publishes it (client's choice 2) - and closes the run.
 * Saving twice (a retried step) returns the post saved the first time.
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
    await tx
      .update(blogAutopilotTopics)
      .set({ status: "written", postId: post.id, error: null, writtenAt: now, updatedAt: now })
      .where(eq(blogAutopilotTopics.id, claim.topicId));
    await tx
      .update(blogAutopilotRuns)
      .set({ status: "done", postId: post.id, finishedAt: now, detail: sql`${blogAutopilotRuns.detail} || ${JSON.stringify(report)}::jsonb` })
      .where(eq(blogAutopilotRuns.id, claim.runId));
    return { postId: post.id, slug };
  });
}

/**
 * Records a run that could not finish: the run and its topic are marked
 * failed with the reason, and "Try again" puts the topic back in the queue.
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
      .returning({ topicId: blogAutopilotRuns.topicId });
    if (!run?.topicId) return;
    await tx
      .update(blogAutopilotTopics)
      .set({ status: "failed", error, updatedAt: now })
      .where(and(eq(blogAutopilotTopics.id, run.topicId), eq(blogAutopilotTopics.status, "writing")));
  });
}

/** Adds what a step found (costs, warnings, picture ideas...) to the run's record. */
export async function noteRun(runId: string, detail: Record<string, unknown>, executor: Executor = db): Promise<void> {
  await executor
    .update(blogAutopilotRuns)
    .set({ detail: sql`${blogAutopilotRuns.detail} || ${JSON.stringify(detail)}::jsonb` })
    .where(eq(blogAutopilotRuns.id, runId));
}
