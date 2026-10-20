import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { articleIndexing, articles, websites } from "@/lib/db/schema";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { notify } from "@/lib/notifications/create";
import { PRICING, track } from "@/lib/usage";

import {
  createIndexTask,
  describeErrorCode,
  readTaskReport,
  readTaskStatuses,
  sameUrl,
  SpeedyIndexError,
  type TaskStatus,
} from "./speedyindex";

/**
 * Google indexing of published articles (client, 2026-10-13): every article
 * that goes live on a customer's site is sent to SpeedyIndex, and when Google
 * has indexed it the customer hears "Your article was indexed" - in the
 * notifications and in the dashboard's 7-day wins.
 *
 * Driven by the index-articles job (inngest/functions/index-articles.ts) in
 * three steps, each safe to repeat:
 *   1. queueNewlyLive - articles first live in the last NEWLY_LIVE_HOURS,
 *      whatever published them (the plugin, a direct connection), get a row,
 *      once per address. Older articles are not sent: no backlog bill.
 *   2. submitQueued   - queued rows go out as one task, within the platform's
 *      daily limit, for websites with a plan (free articles included: being
 *      told "Google indexed it" is part of what those should show off).
 *   3. checkSubmitted - reads the open tasks' results; an indexed URL is
 *      recorded once, which is when the customer is told and the cost
 *      recorded (SpeedyIndex charges only for indexed URLs).
 */

/**
 * How recently an article must have gone live to be sent: 30 days. It was
 * 72 hours until 2026-10-20, which left the articles that went live in the
 * days before indexing shipped (Image Studio's of 1 and 6 October) never
 * sent - the client saw no indexing at all. A month also covers the job
 * being down for days; each address is still sent only once.
 */
export const NEWLY_LIVE_HOURS = 30 * 24;
/** A queued row not sent in this long (an empty balance, say) is given up. */
export const QUEUE_DAYS = 7;
/** SpeedyIndex finishes a task in about a week; past this, no result is the result. */
export const RESULT_DAYS = 10;
/** Sends that failed without an answer before a row is given up. */
export const MAX_ATTEMPTS = 3;
/** Reports read per run; the rest wait for the next. */
const REPORTS_PER_RUN = 50;

const DEFAULT_DAILY_LIMIT = 100;

/**
 * URLs sent per 24 hours across the platform: SPEEDYINDEX_DAILY_LIMIT, 100
 * when unset. Each indexed URL costs 100 tokens (about $0.10 at the smallest
 * package), so this bounds a day's spend whatever happens upstream. 0 pauses
 * sending without turning off the result checks.
 */
export function dailyLimit(): number {
  const raw = process.env.SPEEDYINDEX_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_DAILY_LIMIT;
  const value = Math.floor(Number(raw));
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 10_000) : DEFAULT_DAILY_LIMIT;
}

const iso = (date: Date) => sql`${date.toISOString()}::timestamp`;
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Step 1: a row for each article that went live recently and has none for its address. */
export async function queueNewlyLive(now: Date = new Date()): Promise<number> {
  const rows = await db
    .insert(articleIndexing)
    .select(
      db
        .select({
          id: sql`gen_random_uuid()`.as("id"),
          articleId: articles.id,
          websiteId: articles.websiteId,
          url: sql<string>`btrim(${articles.publishedUrl})`.as("url"),
          status: sql`'queued'`.as("status"),
          taskId: sql`null`.as("task_id"),
          attempts: sql`0`.as("attempts"),
          submittedAt: sql`null`.as("submitted_at"),
          checkedAt: sql`null`.as("checked_at"),
          indexedAt: sql`null`.as("indexed_at"),
          error: sql`null`.as("error"),
          createdAt: sql`${iso(now)}`.as("created_at"),
          updatedAt: sql`${iso(now)}`.as("updated_at"),
        })
        .from(articles)
        .where(
          and(
            eq(articles.status, "published"),
            sql`${articles.publishedUrl} ~* '^https?://'`,
            gte(articles.firstLiveAt, ago(now, NEWLY_LIVE_HOURS * HOUR)),
          ),
        ),
    )
    .onConflictDoNothing()
    .returning({ id: articleIndexing.id });
  return rows.length;
}

export type SubmitOutcome = {
  sent: number;
  /** Held for the next run: the daily limit, or an empty balance. */
  held: number;
  skipped: number;
  failed: number;
  taskId: string | null;
  reason?: "daily_limit" | "balance" | "error";
};

/** Step 2: sends what is queued, as one task. */
export async function submitQueued(now: Date = new Date()): Promise<SubmitOutcome> {
  const outcome: SubmitOutcome = { sent: 0, held: 0, skipped: 0, failed: 0, taskId: null };

  // Never sent in a week: say so rather than leave it queued forever.
  await db
    .update(articleIndexing)
    .set({ status: "failed", error: sql`coalesce(${articleIndexing.error}, 'Not sent')`, updatedAt: now })
    .where(and(eq(articleIndexing.status, "queued"), lt(articleIndexing.createdAt, ago(now, QUEUE_DAYS * DAY))));

  const [{ sentToday }] = await db
    .select({ sentToday: sql<number>`count(*)::int` })
    .from(articleIndexing)
    .where(gte(articleIndexing.submittedAt, ago(now, DAY)));
  const room = Math.max(dailyLimit() - sentToday, 0);

  const queued = await db
    .select({ id: articleIndexing.id, websiteId: articleIndexing.websiteId, url: articleIndexing.url, attempts: articleIndexing.attempts })
    .from(articleIndexing)
    .where(eq(articleIndexing.status, "queued"))
    .orderBy(articleIndexing.createdAt)
    .limit(Math.max(room, 1) + 200);
  if (queued.length === 0) return outcome;

  // Only websites with a plan; decided once per website per run.
  const entitled = new Map<string, boolean>();
  for (const websiteId of new Set(queued.map((row) => row.websiteId))) {
    entitled.set(websiteId, (await isEntitledToSpend(websiteId, { freeArticles: true })).ok);
  }
  const skip = queued.filter((row) => !entitled.get(row.websiteId)).map((row) => row.id);
  if (skip.length > 0) {
    await db
      .update(articleIndexing)
      .set({ status: "skipped", error: "The website has no active plan", updatedAt: now })
      .where(inArray(articleIndexing.id, skip));
    outcome.skipped = skip.length;
  }

  const eligible = queued.filter((row) => entitled.get(row.websiteId));
  const batch = eligible.slice(0, room);
  outcome.held = eligible.length - batch.length;
  if (batch.length === 0) {
    if (outcome.held > 0) outcome.reason = "daily_limit";
    return outcome;
  }

  try {
    const taskId = await createIndexTask([...new Set(batch.map((row) => row.url))], `RepGet ${now.toISOString().slice(0, 16)}`);
    await db
      .update(articleIndexing)
      .set({ status: "submitted", taskId, submittedAt: now, checkedAt: null, error: null, updatedAt: now })
      .where(inArray(articleIndexing.id, batch.map((row) => row.id)));
    return { ...outcome, sent: batch.length, taskId };
  } catch (error) {
    const reason = error instanceof SpeedyIndexError ? error.reason : "network";
    const message = error instanceof Error ? error.message.slice(0, 300) : "Could not send";

    if (reason === "balance") {
      // Kept queued, without using up an attempt: it goes once the balance is topped up.
      await db.update(articleIndexing).set({ error: message, updatedAt: now }).where(inArray(articleIndexing.id, batch.map((row) => row.id)));
      return { ...outcome, held: outcome.held + batch.length, reason: "balance" };
    }

    if (reason === "invalid" && batch.length > 1) {
      // One bad address refuses the whole task: send each alone, so only it fails.
      for (const row of batch) {
        const single = await submitOne(row, now);
        if (single === "sent") outcome.sent += 1;
        else if (single === "failed") outcome.failed += 1;
        else outcome.held += 1;
      }
      return outcome;
    }

    const failed = await recordFailedAttempt(batch, message, reason === "invalid", now);
    return { ...outcome, failed, held: outcome.held + batch.length - failed, reason: "error" };
  }
}

async function submitOne(row: { id: string; url: string; attempts: number }, now: Date): Promise<"sent" | "held" | "failed"> {
  try {
    const taskId = await createIndexTask([row.url], `RepGet ${now.toISOString().slice(0, 16)}`);
    await db
      .update(articleIndexing)
      .set({ status: "submitted", taskId, submittedAt: now, checkedAt: null, error: null, updatedAt: now })
      .where(eq(articleIndexing.id, row.id));
    return "sent";
  } catch (error) {
    const reason = error instanceof SpeedyIndexError ? error.reason : "network";
    const message = error instanceof Error ? error.message.slice(0, 300) : "Could not send";
    if (reason === "balance") {
      await db.update(articleIndexing).set({ error: message, updatedAt: now }).where(eq(articleIndexing.id, row.id));
      return "held";
    }
    return (await recordFailedAttempt([row], message, reason === "invalid", now)) > 0 ? "failed" : "held";
  }
}

/** Counts an attempt; a refused URL, or the third attempt, fails the row. Returns how many failed. */
async function recordFailedAttempt(rows: { id: string; attempts: number }[], message: string, refused: boolean, now: Date): Promise<number> {
  let failed = 0;
  for (const row of rows) {
    const final = refused || row.attempts + 1 >= MAX_ATTEMPTS;
    if (final) failed += 1;
    await db
      .update(articleIndexing)
      .set({ attempts: row.attempts + 1, error: message, status: final ? "failed" : "queued", updatedAt: now })
      .where(and(eq(articleIndexing.id, row.id), eq(articleIndexing.status, "queued")));
  }
  return failed;
}

export type IndexedArticle = { id: string; articleId: string; websiteId: string; organizationId: string; title: string; url: string };

export type CheckOutcome = { tasks: number; indexed: IndexedArticle[]; notIndexed: number };

/** Step 3: reads the open tasks and records what Google indexed. */
export async function checkSubmitted(now: Date = new Date()): Promise<CheckOutcome> {
  const outcome: CheckOutcome = { tasks: 0, indexed: [], notIndexed: 0 };

  const open = await db
    .selectDistinct({ taskId: articleIndexing.taskId })
    .from(articleIndexing)
    .where(and(eq(articleIndexing.status, "submitted"), isNotNull(articleIndexing.taskId)));
  const taskIds = open.map((row) => row.taskId as string);

  if (taskIds.length > 0) {
    const statuses = new Map<string, TaskStatus>();
    for (let i = 0; i < taskIds.length; i += 1000) {
      for (const status of await readTaskStatuses(taskIds.slice(i, i + 1000))) statuses.set(status.id, status);
    }

    // Only tasks with something new to say: an indexed URL, or finished.
    const worth = taskIds.filter((id) => {
      const status = statuses.get(id);
      return status && (status.indexed > 0 || status.completed);
    });
    for (const taskId of worth.slice(0, REPORTS_PER_RUN)) {
      const status = statuses.get(taskId)!;
      const report = await readTaskReport(taskId);
      outcome.tasks += 1;
      const rows = await db
        .select({ id: articleIndexing.id, url: articleIndexing.url })
        .from(articleIndexing)
        .where(and(eq(articleIndexing.taskId, taskId), eq(articleIndexing.status, "submitted")));

      const indexedIds = rows.filter((row) => report.indexed.some((url) => sameUrl(url, row.url))).map((row) => row.id);
      if (indexedIds.length > 0) {
        // Recorded once: a row already indexed is not "submitted", so a repeat finds nothing.
        const newly = await db
          .update(articleIndexing)
          .set({ status: "indexed", indexedAt: now, checkedAt: now, error: null, updatedAt: now })
          .where(and(inArray(articleIndexing.id, indexedIds), eq(articleIndexing.status, "submitted")))
          .returning({ id: articleIndexing.id });
        outcome.indexed.push(...(await describeIndexed(newly.map((row) => row.id))));
      }

      if (status.completed) {
        for (const row of rows.filter((r) => !indexedIds.includes(r.id))) {
          const miss = report.unindexed.find((entry) => sameUrl(entry.url, row.url));
          const result = await db
            .update(articleIndexing)
            .set({ status: "not_indexed", checkedAt: now, error: miss ? describeErrorCode(miss.errorCode) : "No result from SpeedyIndex", updatedAt: now })
            .where(and(eq(articleIndexing.id, row.id), eq(articleIndexing.status, "submitted")))
            .returning({ id: articleIndexing.id });
          outcome.notIndexed += result.length;
        }
      }
    }

    await db
      .update(articleIndexing)
      .set({ checkedAt: now, updatedAt: now })
      .where(and(inArray(articleIndexing.taskId, taskIds), eq(articleIndexing.status, "submitted")));
  }

  // A task SpeedyIndex never finished, or no longer knows.
  const expired = await db
    .update(articleIndexing)
    .set({ status: "not_indexed", error: `No result within ${RESULT_DAYS} days`, updatedAt: now })
    .where(and(eq(articleIndexing.status, "submitted"), lt(articleIndexing.submittedAt, ago(now, RESULT_DAYS * DAY))))
    .returning({ id: articleIndexing.id });
  outcome.notIndexed += expired.length;

  return outcome;
}

async function describeIndexed(ids: string[]): Promise<IndexedArticle[]> {
  if (ids.length === 0) return [];
  return db
    .select({
      id: articleIndexing.id,
      articleId: articleIndexing.articleId,
      websiteId: articleIndexing.websiteId,
      organizationId: websites.organizationId,
      title: articles.title,
      url: articleIndexing.url,
    })
    .from(articleIndexing)
    .innerJoin(articles, eq(articles.id, articleIndexing.articleId))
    .innerJoin(websites, eq(websites.id, articleIndexing.websiteId))
    .where(inArray(articleIndexing.id, ids));
}

/**
 * Tells the customer, and records the cost against their workspace. Best
 * effort: the indexing is recorded either way, and the 7-day wins read it
 * from the table, not from here.
 */
export async function announceIndexed(article: IndexedArticle): Promise<void> {
  await notify({
    organizationId: article.organizationId,
    type: "article.indexed",
    title: `Google indexed "${article.title}"`,
    body: `Your article can now appear in Google search results: ${article.url}`,
    href: `/websites/${article.websiteId}/articles/${article.articleId}`,
  });
  await track(article.organizationId, {
    kind: "seo_api",
    provider: "speedyindex",
    quantity: 1,
    costUsd: PRICING.seo_api.speedyindexIndexedUrl.perCall,
    websiteId: article.websiteId,
    metadata: { purpose: "article_indexing", articleId: article.articleId },
  }).catch((error) => console.error("[indexing] could not record the cost", error));
}
