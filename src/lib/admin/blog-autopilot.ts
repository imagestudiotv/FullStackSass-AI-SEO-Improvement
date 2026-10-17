"use server";

import { and, asc, desc, eq, gt, inArray, lt, max, min, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { isAiConfigured } from "@/lib/ai/client";
import { startAutopilotRun } from "@/lib/blog/autopilot/run";
import {
  AUTOPILOT_KEY,
  autopilotLanguages,
  readAutopilotSettings,
  TOPIC_LIMITS,
  type AutopilotLanguage,
  type AutopilotSettings,
  type TopicStatus,
} from "@/lib/blog/autopilot/settings";
import { db } from "@/lib/db";
import { blogAutopilot, blogAutopilotRuns, blogAutopilotTopics, blogPosts } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Blog -> Autopilot: the settings and the topic list (see
 * lib/blog/autopilot/settings.ts for what the autopilot does and the
 * client's choices). Every action checks admin access on the server; changes
 * are recorded in the admin audit log.
 *
 * Topic rules:
 *  - The queue is written in order (lowest sort_order first). New topics join
 *    the end; "Try again" puts a failed one back at the front.
 *  - Only a topic that is not being written can be edited or deleted. A
 *    written topic is history: deleting it leaves its post untouched.
 *  - The same topic cannot wait twice, and one already written is refused,
 *    so a pasted list cannot make the blog write the same article again.
 */

export type AdminAutopilotTopic = {
  id: string;
  topic: string;
  keyword: string | null;
  notes: string | null;
  source: string;
  status: TopicStatus;
  error: string | null;
  createdAt: Date;
  writtenAt: Date | null;
  /** The English post written for it, while it exists. */
  post: { id: string; title: string; status: string } | null;
};

export type AdminAutopilotRun = {
  id: string;
  runDate: string;
  trigger: string;
  status: string;
  topic: string | null;
  postId: string | null;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  /** From the run's record: what its AI cost (in all, and for the writing, the pictures and the translations), its length, what fell short of the house style. */
  costUsd: number | null;
  costs: { writing: number; pictures: number; translations: number };
  words: number | null;
  /** The translations it saved, once it has finished. */
  translations: number | null;
  warnings: string[];
};

export type AdminAutopilot = {
  settings: AutopilotSettings;
  /** Waiting, in the order they will be written. */
  queued: AdminAutopilotTopic[];
  /** Being written right now. */
  writing: AdminAutopilotTopic[];
  failed: AdminAutopilotTopic[];
  /** Most recent first. */
  written: AdminAutopilotTopic[];
  runs: AdminAutopilotRun[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "That topic no longer exists - reload the page";
const BUSY = "That topic is being written right now - wait for the run to finish";

function refresh() {
  revalidatePath("/admin/blog/autopilot");
}

const oneLine = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
/** Compared without case or spacing: "Local SEO  tips" waits once, however it is typed. */
const sameTopic = (value: string) => oneLine(value).toLowerCase();

type TopicInput = { topic: string; keyword?: string; notes?: string };
type CleanTopic = { topic: string; keyword: string | null; notes: string | null };

function cleanTopic(input: TopicInput): CleanTopic | string {
  const topic = oneLine(input.topic);
  if (topic.length < TOPIC_LIMITS.topicMin) return "Write what the article should be about";
  if (topic.length > TOPIC_LIMITS.topic) return `Keep the topic under ${TOPIC_LIMITS.topic} characters - add the details as notes`;
  const keyword = oneLine(input.keyword);
  if (keyword.length > TOPIC_LIMITS.keyword) return `Keep the search phrase under ${TOPIC_LIMITS.keyword} characters`;
  const notes = String(input.notes ?? "").trim();
  if (notes.length > TOPIC_LIMITS.notes) return `Keep the notes under ${TOPIC_LIMITS.notes} characters`;
  return { topic, keyword: keyword || null, notes: notes || null };
}

/**
 * The figures the autopilot kept with the run, read defensively: the cost of
 * each step by its name (lib/blog/autopilot/run.ts noteCost) - "plan-article"
 * and "write-part-N" are the writing, "picture-*" the pictures,
 * "translate-*" the translations - and the checks' report.
 */
function runFigures(detail: Record<string, unknown>): Pick<AdminAutopilotRun, "costUsd" | "costs" | "words" | "translations" | "warnings"> {
  const costs = { writing: 0, pictures: 0, translations: 0 };
  let any = false;
  for (const [stepId, value] of Object.entries((detail.costs ?? {}) as Record<string, unknown>)) {
    const usd = Number(value);
    if (!Number.isFinite(usd)) continue;
    any = true;
    if (stepId.startsWith("picture-")) costs.pictures += usd;
    else if (stepId.startsWith("translate-")) costs.translations += usd;
    else costs.writing += usd;
  }
  return {
    costUsd: any ? costs.writing + costs.pictures + costs.translations : null,
    costs,
    words: typeof detail.words === "number" ? detail.words : null,
    translations: detail.translations && typeof detail.translations === "object" ? Object.keys(detail.translations).length : null,
    warnings: Array.isArray(detail.warnings) ? detail.warnings.filter((warning): warning is string => typeof warning === "string") : [],
  };
}

/** Everything the page shows. */
export async function getBlogAutopilotAdmin(): Promise<AdminAutopilot> {
  await requireAdmin();
  const settings = await readAutopilotSettings();
  const rows = await db
    .select({
      topic: blogAutopilotTopics,
      postTitle: blogPosts.title,
      postStatus: blogPosts.status,
    })
    .from(blogAutopilotTopics)
    .leftJoin(blogPosts, eq(blogPosts.id, blogAutopilotTopics.postId))
    .orderBy(asc(blogAutopilotTopics.sortOrder), asc(blogAutopilotTopics.createdAt));
  const topics: AdminAutopilotTopic[] = rows.map(({ topic, postTitle, postStatus }) => ({
    id: topic.id,
    topic: topic.topic,
    keyword: topic.keyword,
    notes: topic.notes,
    source: topic.source,
    status: topic.status as TopicStatus,
    error: topic.error,
    createdAt: topic.createdAt,
    writtenAt: topic.writtenAt,
    post: topic.postId && postTitle && postStatus ? { id: topic.postId, title: postTitle, status: postStatus } : null,
  }));
  const runRows = await db
    .select({ run: blogAutopilotRuns, topic: blogAutopilotTopics.topic })
    .from(blogAutopilotRuns)
    .leftJoin(blogAutopilotTopics, eq(blogAutopilotTopics.id, blogAutopilotRuns.topicId))
    .orderBy(desc(blogAutopilotRuns.startedAt))
    .limit(14);
  return {
    settings,
    queued: topics.filter((topic) => topic.status === "queued"),
    writing: topics.filter((topic) => topic.status === "writing"),
    failed: topics.filter((topic) => topic.status === "failed"),
    written: topics
      .filter((topic) => topic.status === "written")
      .sort((a, b) => (b.writtenAt?.getTime() ?? 0) - (a.writtenAt?.getTime() ?? 0)),
    runs: runRows.map(({ run, topic }) => ({
      id: run.id,
      runDate: run.runDate,
      trigger: run.trigger,
      status: run.status,
      topic,
      postId: run.postId,
      error: run.error,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      ...runFigures(run.detail),
    })),
  };
}

/** Turns the autopilot on or off, and sets its hour and languages. */
export async function saveBlogAutopilotSettings(input: {
  enabled: boolean;
  runHour: number;
  languages: string[];
}): Promise<ActionResult<AutopilotSettings>> {
  const admin = await requireAdmin();
  const runHour = Number(input.runHour);
  if (!Number.isInteger(runHour) || runHour < 0 || runHour > 23) return { ok: false, error: "Choose the hour to write at" };
  const languages: AutopilotLanguage[] = autopilotLanguages(input.languages);
  const enabled = input.enabled === true;
  const before = await readAutopilotSettings();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(blogAutopilot)
      .values({ key: AUTOPILOT_KEY, enabled, runHour, languages, updatedBy: admin.email, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: blogAutopilot.key, set: { enabled, runHour, languages, updatedBy: admin.email, updatedAt: now } });
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "blog.autopilot_settings_saved",
        targetType: "blog_autopilot",
        summary:
          before.enabled !== enabled
            ? `Turned the blog autopilot ${enabled ? "on" : "off"}`
            : "Changed the blog autopilot's settings",
        detail: { enabled, runHour, languages },
      },
      tx,
    );
  });
  refresh();
  return { ok: true, data: await readAutopilotSettings() };
}

/**
 * Adds topics to the end of the queue: one from the form, or a pasted list
 * (one per line; "topic | search phrase" sets the phrase). Lines already
 * waiting or written are skipped and counted, not added again.
 */
export async function addBlogAutopilotTopics(input: {
  topics: TopicInput[];
}): Promise<ActionResult<{ added: number; skipped: string[] }>> {
  const admin = await requireAdmin();
  const rows = Array.isArray(input.topics) ? input.topics : [];
  if (rows.length === 0) return { ok: false, error: "Write what the article should be about" };
  if (rows.length > TOPIC_LIMITS.bulk) return { ok: false, error: `Add up to ${TOPIC_LIMITS.bulk} topics at a time` };
  const cleaned: CleanTopic[] = [];
  for (const [index, row] of rows.entries()) {
    const clean = cleanTopic(row);
    if (typeof clean === "string") return { ok: false, error: rows.length > 1 ? `Line ${index + 1}: ${clean}` : clean };
    cleaned.push(clean);
  }

  const result = await db.transaction(async (tx) => {
    // Serialises additions, so two pastes at once cannot both add the same topic.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('blog_autopilot_topics'))`);
    const existing = await tx
      .select({ topic: blogAutopilotTopics.topic })
      .from(blogAutopilotTopics)
      .where(inArray(blogAutopilotTopics.status, ["queued", "writing", "written"]));
    const taken = new Set(existing.map((row) => sameTopic(row.topic)));
    const fresh: CleanTopic[] = [];
    const skipped: string[] = [];
    for (const topic of cleaned) {
      const key = sameTopic(topic.topic);
      if (taken.has(key)) skipped.push(topic.topic);
      else {
        taken.add(key);
        fresh.push(topic);
      }
    }
    if (fresh.length === 0) return { added: 0, skipped };
    const [{ last }] = await tx.select({ last: max(blogAutopilotTopics.sortOrder) }).from(blogAutopilotTopics);
    const start = (last ?? 0) + 1;
    const now = new Date();
    await tx.insert(blogAutopilotTopics).values(
      fresh.map((topic, index) => ({
        ...topic,
        source: "admin",
        status: "queued",
        sortOrder: start + index,
        createdBy: admin.email,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "blog.autopilot_topics_added",
        targetType: "blog_autopilot",
        summary:
          fresh.length === 1
            ? `Added "${fresh[0].topic}" to the blog autopilot's topics`
            : `Added ${fresh.length} topics to the blog autopilot`,
        detail: { topics: fresh.map((topic) => topic.topic), skipped },
      },
      tx,
    );
    return { added: fresh.length, skipped };
  });
  refresh();
  return { ok: true, data: result };
}

/** Rewrites a topic that is waiting or failed. */
export async function saveBlogAutopilotTopic(input: TopicInput & { id: string }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(input.id))) return { ok: false, error: NOT_FOUND };
  const clean = cleanTopic(input);
  if (typeof clean === "string") return { ok: false, error: clean };
  const error = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('blog_autopilot_topics'))`);
    const [current] = await tx.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, input.id)).for("update");
    if (!current) return NOT_FOUND;
    if (current.status === "writing") return BUSY;
    if (current.status === "written") return "That topic has been written - add a new topic instead";
    const [clash] = await tx
      .select({ id: blogAutopilotTopics.id })
      .from(blogAutopilotTopics)
      .where(
        and(
          inArray(blogAutopilotTopics.status, ["queued", "writing", "written"]),
          sql`lower(regexp_replace(btrim(${blogAutopilotTopics.topic}), '\\s+', ' ', 'g')) = ${sameTopic(clean.topic)}`,
          sql`${blogAutopilotTopics.id} <> ${current.id}`,
        ),
      )
      .limit(1);
    if (clash) return "Another topic already says that";
    await tx.update(blogAutopilotTopics).set({ ...clean, updatedAt: new Date() }).where(eq(blogAutopilotTopics.id, current.id));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "blog.autopilot_topic_saved",
        targetType: "blog_autopilot_topic",
        targetId: current.id,
        summary: `Changed the blog autopilot topic "${clean.topic}"`,
        detail: { before: current.topic },
      },
      tx,
    );
    return null;
  });
  if (error) return { ok: false, error };
  refresh();
  return { ok: true, data: null };
}

/** Removes a topic that is not being written. A written topic's post stays. */
export async function deleteBlogAutopilotTopic(id: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(id))) return { ok: false, error: NOT_FOUND };
  const error = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, id)).for("update");
    if (!current) return NOT_FOUND;
    if (current.status === "writing") return BUSY;
    await tx.delete(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, current.id));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "blog.autopilot_topic_deleted",
        targetType: "blog_autopilot_topic",
        targetId: current.id,
        summary: `Removed "${current.topic}" from the blog autopilot's topics`,
        detail: { status: current.status, postId: current.postId },
      },
      tx,
    );
    return null;
  });
  if (error) return { ok: false, error };
  refresh();
  return { ok: true, data: null };
}

/** Moves a waiting topic one place earlier or later in the queue. */
export async function moveBlogAutopilotTopic(id: string, direction: "up" | "down"): Promise<ActionResult<null>> {
  await requireAdmin();
  if (!UUID.test(String(id)) || (direction !== "up" && direction !== "down")) return { ok: false, error: NOT_FOUND };
  const moved = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, id)).for("update");
    if (!current || current.status !== "queued") return false;
    const [neighbour] = await tx
      .select()
      .from(blogAutopilotTopics)
      .where(
        and(
          eq(blogAutopilotTopics.status, "queued"),
          direction === "up" ? lt(blogAutopilotTopics.sortOrder, current.sortOrder) : gt(blogAutopilotTopics.sortOrder, current.sortOrder),
        ),
      )
      .orderBy(direction === "up" ? desc(blogAutopilotTopics.sortOrder) : asc(blogAutopilotTopics.sortOrder))
      .limit(1)
      .for("update");
    if (!neighbour) return true;
    // The order is not an edit of either topic.
    await tx.update(blogAutopilotTopics).set({ sortOrder: neighbour.sortOrder }).where(eq(blogAutopilotTopics.id, current.id));
    await tx.update(blogAutopilotTopics).set({ sortOrder: current.sortOrder }).where(eq(blogAutopilotTopics.id, neighbour.id));
    return true;
  });
  if (!moved) return { ok: false, error: NOT_FOUND };
  refresh();
  return { ok: true, data: null };
}

/** Puts a topic that could not be written back at the front of the queue. */
export async function retryBlogAutopilotTopic(id: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(id))) return { ok: false, error: NOT_FOUND };
  const error = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, id)).for("update");
    if (!current) return NOT_FOUND;
    if (current.status !== "failed") return "Only a topic that could not be written can be tried again";
    const [{ first }] = await tx
      .select({ first: min(blogAutopilotTopics.sortOrder) })
      .from(blogAutopilotTopics)
      .where(eq(blogAutopilotTopics.status, "queued"));
    await tx
      .update(blogAutopilotTopics)
      .set({ status: "queued", error: null, sortOrder: (first ?? current.sortOrder + 1) - 1, updatedAt: new Date() })
      .where(eq(blogAutopilotTopics.id, current.id));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "blog.autopilot_topic_saved",
        targetType: "blog_autopilot_topic",
        targetId: current.id,
        summary: `Queued "${current.topic}" to be written again`,
        detail: { previousError: current.error },
      },
      tx,
    );
    return null;
  });
  if (error) return { ok: false, error };
  refresh();
  return { ok: true, data: null };
}

/**
 * Writes the next topic now, without waiting for the day's hour (and
 * whether or not the daily article is switched on). The topic is taken at
 * once - the page shows it being written - and a second press is refused
 * until it is done. Saved as a draft, like every autopilot article.
 */
export async function writeBlogAutopilotNow(): Promise<ActionResult<{ topic: string }>> {
  const admin = await requireAdmin();
  if (!isAiConfigured()) return { ok: false, error: "The AI is not set up on this server (ANTHROPIC_API_KEY), so nothing can be written yet" };
  const outcome = await startAutopilotRun({
    trigger: "manual",
    requestedBy: admin.email,
    record: (tx, claim) =>
      recordAdminAction(
        {
          actorEmail: admin.email,
          action: "blog.autopilot_run_started",
          targetType: "blog_autopilot_topic",
          targetId: claim.topicId,
          summary: `Started writing "${claim.topic}" with the blog autopilot`,
          detail: { runId: claim.runId },
        },
        tx,
      ),
  });
  if ("skipped" in outcome) {
    return {
      ok: false,
      error: outcome.skipped === "empty" ? "Add a topic first - nothing is waiting to be written" : "An article is being written right now - wait for it to finish",
    };
  }
  refresh();
  return { ok: true, data: { topic: outcome.claimed.topic } };
}
