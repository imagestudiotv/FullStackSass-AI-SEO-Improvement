import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogAutopilotRuns, blogAutopilotTopics, blogPosts, jobOutbox } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The blog autopilot's runs in the database: one article at a time, the
 * topic taken with its run and its job in one transaction, the draft saved
 * once, and a run that fails - or never starts - handing its topic back.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const inngestMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

import { recordAdminAction } from "@/lib/admin/audit";
import { BlogPostError, type BlogPostInput } from "@/lib/blog/post-fields";
import { TEAM_AUTHOR } from "@/lib/blog/shared";
import { deliverJobs, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";

import {
  AUTOPILOT_ACTOR,
  failAutopilotRun,
  finishAutopilotRun,
  loadClaim,
  noteCost,
  RUN_EVENT,
  saveAutopilotDraft,
  startAutopilotRun,
  type AutopilotClaim,
} from "./run";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(blogAutopilotRuns);
  await test.db.delete(blogAutopilotTopics);
  await test.db.delete(blogPosts);
  await test.db.delete(jobOutbox);
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: ["evt"] });
});

async function topics(...names: string[]) {
  await test.db.insert(blogAutopilotTopics).values(names.map((topic, index) => ({ topic, sortOrder: index + 1, status: "queued" })));
}
const topicRow = async (topic: string) => (await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.topic, topic)))[0];
const runRow = async (id: string) => (await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, id)))[0];

async function claimed(trigger: "manual" | "schedule" = "manual", now?: Date): Promise<AutopilotClaim> {
  const outcome = await startAutopilotRun({ trigger, requestedBy: "admin@repget.test", now });
  if (!("claimed" in outcome)) throw new Error(`skipped: ${outcome.skipped}`);
  return outcome.claimed;
}

function draft(overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  return {
    title: "Local SEO for Plumbers: How to Get Found",
    slug: "local-seo-for-plumbers",
    description: "Learn local SEO for plumbers.",
    seoTitle: "Local SEO for Plumbers",
    primaryKeyword: "local SEO for plumbers",
    secondaryKeywords: ["plumber SEO"],
    breadcrumbLabel: "Local SEO for Plumbers: How to Get Found",
    category: "Playbooks",
    author: TEAM_AUTHOR,
    shortAnswer: "Start with your Business Profile.",
    bodyHtml: "<p>Someone searches for a plumber.</p><h2>How it works</h2><p>Text.</p>",
    faqs: [{ question: "What is local SEO?", answer: "<p>Being found nearby.</p>" }],
    sources: [],
    locale: "en",
    ...overrides,
  };
}

describe("taking a topic", () => {
  it("takes the first waiting topic, with its run and its job, and sends the job", async () => {
    await topics("First", "Second");
    const now = new Date("2026-10-17T06:00:00Z");
    const claim = await claimed("manual", now);
    expect(claim).toMatchObject({ topic: "First", claimedAt: now.toISOString() });
    expect((await topicRow("First")).status).toBe("writing");
    expect((await topicRow("Second")).status).toBe("queued");
    expect(await runRow(claim.runId)).toMatchObject({
      runDate: "2026-10-17",
      trigger: "manual",
      status: "running",
      topicId: claim.topicId,
      detail: { requestedBy: "admin@repget.test" },
    });
    const [job] = await test.db.select().from(jobOutbox);
    expect(job).toMatchObject({ eventId: `${RUN_EVENT}:${claim.runId}`, name: RUN_EVENT, data: { runId: claim.runId }, status: "sent" });
    expect(inngestMock.send).toHaveBeenCalledWith(expect.objectContaining({ id: `${RUN_EVENT}:${claim.runId}`, name: RUN_EVENT }));
  });

  it("writes one article at a time", async () => {
    await topics("First", "Second");
    await claimed();
    expect(await startAutopilotRun({ trigger: "manual" })).toEqual({ skipped: "busy" });
    expect((await topicRow("Second")).status).toBe("queued");
    expect(await test.db.select().from(jobOutbox)).toHaveLength(1);
  });

  it("does nothing when no topic waits", async () => {
    expect(await startAutopilotRun({ trigger: "schedule" })).toEqual({ skipped: "empty" });
    expect(await test.db.select().from(blogAutopilotRuns)).toHaveLength(0);
  });

  it("writes the day's scheduled article once, however often the schedule fires", async () => {
    await topics("First", "Second");
    const morning = new Date("2026-10-17T06:00:00Z");
    const first = await claimed("schedule", morning);
    await failAutopilotRun(first.runId, "Overloaded");
    expect(await startAutopilotRun({ trigger: "schedule", now: new Date("2026-10-17T06:05:00Z") })).toEqual({ skipped: "done-today" });
    // Nothing taken, and nothing left half-taken.
    expect((await topicRow("Second")).status).toBe("queued");
    // "Write one now" is not the schedule: it can still write today.
    expect((await claimed("manual", new Date("2026-10-17T09:00:00Z"))).topic).toBe("Second");
  });

  it("records the administrator's log entry in the same transaction", async () => {
    await topics("First");
    const outcome = await startAutopilotRun({
      trigger: "manual",
      record: (tx, claim) =>
        recordAdminAction({ actorEmail: "admin@repget.test", action: "blog.autopilot_run_started", targetType: "blog_autopilot_topic", targetId: claim.topicId, summary: "Started" }, tx),
    });
    expect("claimed" in outcome).toBe(true);
    const log = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "blog.autopilot_run_started"));
    expect(log).toHaveLength(1);
  });

  it("is handed back when its job can never be sent", async () => {
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    await topics("First");
    const claim = await claimed();
    await test.client.query("update job_outbox set attempts = $1 where status = 'pending'", [MAX_DELIVERY_ATTEMPTS - 1]);
    await deliverJobs(test.db, { now: new Date(Date.now() + 24 * 3600 * 1000) });
    expect(await runRow(claim.runId)).toMatchObject({ status: "failed", error: "The writing could not be started. Try again." });
    expect(await topicRow("First")).toMatchObject({ status: "failed", error: "The writing could not be started. Try again." });
  });
});

describe("the run's job", () => {
  it("reads its topic while the run is going, and nothing once it is over", async () => {
    await topics("First");
    const claim = await claimed();
    expect(await loadClaim(claim.runId)).toEqual(claim);
    await failAutopilotRun(claim.runId, "Overloaded");
    expect(await loadClaim(claim.runId)).toBeNull();
    expect(await loadClaim("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("saves the article as a draft by the RepGet team, once; the run is closed when everything is done", async () => {
    await topics("First");
    const claim = await claimed();
    const saved = await saveAutopilotDraft(claim, draft(), { words: 3_400, usage: { costUsd: 1.02 } });
    // Saved, but the run goes on (the translations) until it is closed.
    expect(await runRow(claim.runId)).toMatchObject({ status: "running", postId: saved.postId });
    expect(await topicRow("First")).toMatchObject({ status: "writing", postId: saved.postId });
    await finishAutopilotRun(claim, { translations: 4 });
    await finishAutopilotRun(claim, { translations: 99 });
    expect(saved.slug).toBe("local-seo-for-plumbers");

    const [post] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, saved.postId));
    expect(post).toMatchObject({
      status: "draft",
      publishedAt: null,
      locale: "en",
      author: TEAM_AUTHOR,
      category: "Playbooks",
      seoTitle: "Local SEO for Plumbers",
      primaryKeyword: "local SEO for plumbers",
      createdBy: AUTOPILOT_ACTOR,
      needsReview: false,
    });
    expect(await topicRow("First")).toMatchObject({ status: "written", postId: saved.postId, error: null });
    expect(await runRow(claim.runId)).toMatchObject({
      status: "done",
      postId: saved.postId,
      detail: { requestedBy: "admin@repget.test", words: 3_400, usage: { costUsd: 1.02 }, translations: 4 },
    });
    expect((await topicRow("First")).writtenAt).not.toBeNull();
    const [log] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, saved.postId));
    expect(log).toMatchObject({ actorEmail: AUTOPILOT_ACTOR, action: "blog.post_created" });

    // A retried step returns the same post and writes nothing new.
    expect(await saveAutopilotDraft(claim, draft(), {})).toEqual(saved);
    expect(await test.db.select().from(blogPosts)).toHaveLength(1);
  });

  it("gives the post a free address when its own is taken", async () => {
    await test.db.insert(blogPosts).values([
      { slug: "local-seo-for-plumbers", title: "Older", category: "Guides", author: TEAM_AUTHOR },
      { slug: "local-seo-for-plumbers-2", title: "Older too", category: "Guides", author: TEAM_AUTHOR, locale: "it" },
    ]);
    await topics("First");
    expect((await saveAutopilotDraft(await claimed(), draft(), {})).slug).toBe("local-seo-for-plumbers-3");
  });

  it("refuses an article that breaks the blog's rules, saying which", async () => {
    await topics("First");
    const claim = await claimed();
    await expect(saveAutopilotDraft(claim, draft({ description: "" }), {})).rejects.toThrow(BlogPostError);
    await expect(saveAutopilotDraft(claim, draft({ category: "News" }), {})).rejects.toThrow('The category "News" no longer exists');
    expect(await test.db.select().from(blogPosts)).toHaveLength(0);
    expect((await topicRow("First")).status).toBe("writing");
  });

  it("marks a failed run and its topic, so the topic can be tried again; a finished run is left alone", async () => {
    await topics("First", "Second");
    const claim = await claimed();
    await failAutopilotRun(claim.runId, "  The AI   ran out of room while writing. Try again.  ");
    expect(await runRow(claim.runId)).toMatchObject({ status: "failed", error: "The AI ran out of room while writing. Try again." });
    expect(await topicRow("First")).toMatchObject({ status: "failed", error: "The AI ran out of room while writing. Try again." });

    const next = await claimed();
    await saveAutopilotDraft(next, draft(), {});
    await finishAutopilotRun(next);
    await failAutopilotRun(next.runId, "Late failure");
    expect((await runRow(next.runId)).status).toBe("done");
    expect((await topicRow("Second")).status).toBe("written");
  });

  it("keeps the topic written when the run fails after its English draft was saved, so it is never written twice", async () => {
    await topics("First");
    const claim = await claimed();
    const saved = await saveAutopilotDraft(claim, draft(), {});
    await failAutopilotRun(claim.runId, "The translations could not be finished");
    expect(await runRow(claim.runId)).toMatchObject({ status: "failed", error: "The translations could not be finished", postId: saved.postId });
    expect(await topicRow("First")).toMatchObject({ status: "written", postId: saved.postId });
  });

  it("keeps what each step cost under its name, so a retried step is not counted twice", async () => {
    await topics("First");
    const claim = await claimed();
    await noteCost(claim.runId, "plan-article", 0.31234);
    await noteCost(claim.runId, "picture-en-1", 0.19);
    await noteCost(claim.runId, "picture-en-1", 0.19);
    await noteCost(claim.runId, "picture-en-2", -1);
    expect((await runRow(claim.runId)).detail).toEqual({ requestedBy: "admin@repget.test", costs: { "plan-article": 0.3123, "picture-en-1": 0.19, "picture-en-2": 0 } });
  });
});
