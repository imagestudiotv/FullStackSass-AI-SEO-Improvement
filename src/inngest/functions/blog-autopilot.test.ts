import { eq } from "drizzle-orm";
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blogAutopilotRuns, blogAutopilotTopics, blogPosts, jobOutbox } from "@/lib/db/schema";
import { message, partReplies, planReply } from "@/test/blog-autopilot";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The blog autopilot's job from start to finish, on a real (in-process)
 * database with the model mocked: a topic becomes an English draft with
 * every field, its costs and picture ideas kept with the run; a failure
 * retries only the step that failed; and a run that cannot finish hands its
 * topic back.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
const ai = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { stream: ai.stream } },
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5", BLOG: "claude-opus-5-5" },
  isAiConfigured: () => true,
}));
// The pictures: OpenAI images and storage, mocked (a blank PNG; an address per stored file).
const images = vi.hoisted(() => ({ generate: vi.fn(), configured: vi.fn(() => true), stored: [] as string[] }));
vi.mock("@/lib/images/generate", () => ({ generateOpenAiImage: images.generate, isOpenAiImageConfigured: images.configured }));
vi.mock("@/lib/images/storage", () => ({
  isImageStorageConfigured: () => true,
  storeArticleImage: async (_folder: string, sub: string) => {
    images.stored.push(sub);
    return `https://storage.example/article-images/blog/${sub}/${images.stored.length}.webp`;
  },
}));

import { startAutopilotRun } from "@/lib/blog/autopilot/run";
import { bodyParts } from "@/lib/blog/autopilot/write";

import { blogAutopilotRun } from "./blog-autopilot";

type Handler = (input: unknown) => Promise<unknown>;
type Job = { config: { onFailure: Handler; concurrency: unknown; triggers: unknown }; handler: Handler };
const job = blogAutopilotRun as unknown as Job;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let test: TestDb;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
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
  ai.stream.mockReset();
  images.generate.mockReset();
  images.generate.mockImplementation(async () => ({ data: await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#fff" } }).png().toBuffer(), costUsd: 0.19 }));
  images.configured.mockReturnValue(true);
  images.stored.length = 0;
});

/** Inngest-style memoisation: a finished step replays its stored (JSON) result on a retry. */
function memoisedStep() {
  const done = new Map<string, unknown>();
  const ran: string[] = [];
  return {
    ran,
    run: async (id: string, fn: () => unknown) => {
      if (done.has(id)) return done.get(id);
      ran.push(id);
      const result = JSON.parse(JSON.stringify((await fn()) ?? null));
      done.set(id, result);
      return result;
    },
  };
}

/** The model's answers in order: the plan, then each part of the body. */
function modelWrites(...replies: unknown[]) {
  for (const reply of replies) ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => reply }));
}
const WHOLE_ARTICLE = () => [message(planReply()), ...partReplies(bodyParts(10)).map((part) => message(part, { usage: { cache_creation_input_tokens: 0, cache_read_input_tokens: 20_000 } }))];

async function queuedRun() {
  await test.db.insert(blogAutopilotTopics).values({ topic: "Local SEO for plumbers", keyword: "local SEO for plumbers", sortOrder: 1 });
  const outcome = await startAutopilotRun({ trigger: "manual", requestedBy: "admin@repget.test" });
  if (!("claimed" in outcome)) throw new Error("no claim");
  return outcome.claimed;
}

describe("the blog autopilot's job", () => {
  it("runs one article at a time, on the run event", () => {
    expect(job.config.concurrency).toEqual({ limit: 1 });
    expect(job.config.triggers).toEqual([{ event: "blog/autopilot.run" }]);
  });

  it("writes the topic as an English draft with every field, keeping its costs and picture ideas with the run", async () => {
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const step = memoisedStep();
    const result = (await job.handler({ event: { data: { runId: claim.runId } }, step, logger })) as { written: boolean; postId: string };

    expect(result.written).toBe(true);
    expect(step.ran).toEqual([
      "load-run",
      "plan-article",
      "write-part-1",
      "write-part-2",
      "write-part-3",
      "check-article",
      "can-make-pictures",
      "picture-en-1",
      "picture-en-2",
      "save-draft",
      "finish-run",
    ]);
    // One plan and three parts, all asking Opus 5.5 with the same instructions, so the cache serves the later calls.
    expect(ai.stream).toHaveBeenCalledTimes(4);
    const systems = ai.stream.mock.calls.map(([params]) => JSON.stringify((params as { system: unknown }).system));
    expect(new Set(systems).size).toBe(1);
    for (const [params] of ai.stream.mock.calls) expect(params).toMatchObject({ model: "claude-opus-5-5", output_config: { effort: "high" } });

    const [post] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, result.postId));
    expect(post).toMatchObject({
      status: "draft",
      locale: "en",
      title: "Local SEO for Plumbers: How to Get Found by Nearby Customers",
      slug: "local-seo-for-plumbers",
      seoTitle: "Local SEO for Plumbers: A Practical Guide",
      primaryKeyword: "local SEO for plumbers",
      category: "Playbooks",
      author: "RepGet team",
      breadcrumbLabel: "Local SEO for Plumbers: How to Get Found by Nearby Customers",
    });
    expect(post.secondaryKeywords).toHaveLength(3);
    expect(post.faqs).toHaveLength(6);
    expect(post.shortAnswer?.length).toBeGreaterThan(300);
    expect((post.bodyHtml.match(/<h2>/g) ?? []).length).toBe(10);
    expect(post.bodyHtml).toContain('<a href="https://www.repget.com/audit">free website audit</a>');
    // The two diagrams, made in English and stored with the English pictures, in the sections they illustrate.
    expect(images.generate).toHaveBeenCalledTimes(2);
    expect(images.generate.mock.calls[0][0]).toContain('Headline at the top, large: "From search to call".');
    expect(images.stored).toEqual(["posts/en", "posts/en"]);
    const sectionOf = (url: string) => post.bodyHtml.slice(0, post.bodyHtml.indexOf(url)).match(/<h2>/g)?.length;
    expect(post.bodyHtml).toContain('alt="How a local search becomes a call" width="1536" height="1024"');
    expect(sectionOf("https://storage.example/article-images/blog/posts/en/1.webp")).toBe(1);
    expect(sectionOf("https://storage.example/article-images/blog/posts/en/2.webp")).toBe(7);

    const [topic] = await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, claim.topicId));
    expect(topic).toMatchObject({ status: "written", postId: post.id });
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect(run).toMatchObject({ status: "done", postId: post.id });
    const detail = run.detail as {
      model: string;
      usage: { calls: number; costUsd: number };
      costs: Record<string, number>;
      words: number;
      pictures: unknown[];
      picturesMade: number;
      warnings: string[];
    };
    expect(detail.model).toBe("claude-opus-5-5");
    expect(detail.usage.calls).toBe(4);
    // The plan writes the cache ($5/M); the parts read it ($0.20/M).
    expect(detail.usage.costUsd).toBeCloseTo((4_000 * 4 + 8_000 * 20 + 20_000 * 5 + 60_000 * 0.2) / 1_000_000, 4);
    expect(detail.words).toBeGreaterThan(3_200);
    expect(detail.pictures).toHaveLength(2);
    expect(detail.picturesMade).toBe(2);
    expect(detail.warnings).toEqual([]);
    expect(detail.costs).toMatchObject({ "picture-en-1": 0.19, "picture-en-2": 0.19 });
    expect(Object.keys(detail.costs)).toEqual(expect.arrayContaining(["plan-article", "write-part-1", "write-part-2", "write-part-3"]));
  });

  it("retries only the step that failed: the plan and the parts already written are not paid for twice", async () => {
    const claim = await queuedRun();
    const [plan, part1, , part3] = WHOLE_ARTICLE();
    const part2 = partReplies(bodyParts(10))[1];
    modelWrites(plan, part1);
    ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => Promise.reject(new Error("overloaded_error")) }));
    const step = memoisedStep();
    await expect(job.handler({ event: { data: { runId: claim.runId } }, step, logger })).rejects.toThrow("overloaded_error");

    modelWrites(message(part2), part3);
    await job.handler({ event: { data: { runId: claim.runId } }, step, logger });
    expect(ai.stream).toHaveBeenCalledTimes(5);
    expect(step.ran.filter((id) => id === "plan-article")).toHaveLength(1);
    expect(await test.db.select().from(blogPosts)).toHaveLength(1);
  });

  it("saves the article when a picture cannot be made, and says which one to add by hand", async () => {
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    images.generate.mockRejectedValueOnce(new Error("Image provider rejected the request (400): content policy"));
    const result = (await job.handler({ event: { data: { runId: claim.runId } }, step: memoisedStep(), logger })) as { postId: string };
    const [post] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, result.postId));
    expect(post.bodyHtml.match(/<img /g)).toHaveLength(1);
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect(run.status).toBe("done");
    expect((run.detail as { warnings: string[] }).warnings).toEqual([
      'Picture 1 ("From search to call") could not be made: Image provider rejected the request (400): content policy. Add one by hand if the section needs it.',
    ]);
  });

  it("writes the article without pictures where they are not set up, and says so", async () => {
    images.configured.mockReturnValue(false);
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const result = (await job.handler({ event: { data: { runId: claim.runId } }, step: memoisedStep(), logger })) as { postId: string };
    const [post] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, result.postId));
    expect(post.bodyHtml).not.toContain("<img");
    expect(images.generate).not.toHaveBeenCalled();
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect((run.detail as { warnings: string[] }).warnings).toEqual([
      "Pictures are not set up on this server (an OpenAI image key and image storage), so the article has none.",
    ]);
  });

  it("hands the topic back with the reason when every retry is spent", async () => {
    const claim = await queuedRun();
    await job.config.onFailure({ event: { data: { event: { data: { runId: claim.runId } } } }, error: new Error("The AI ran out of room while writing. Try again."), logger });
    const [topic] = await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, claim.topicId));
    expect(topic).toMatchObject({ status: "failed", error: "The AI ran out of room while writing. Try again." });
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect(run.status).toBe("failed");
  });

  it("does nothing for a run that is no longer waiting", async () => {
    const claim = await queuedRun();
    await test.db.update(blogAutopilotRuns).set({ status: "failed" }).where(eq(blogAutopilotRuns.id, claim.runId));
    expect(await job.handler({ event: { data: { runId: claim.runId } }, step: memoisedStep(), logger })).toEqual({ written: false });
    expect(ai.stream).not.toHaveBeenCalled();
  });

  it("does not retry an article that breaks the blog's rules", async () => {
    const claim = await queuedRun();
    const parts = partReplies(bodyParts(10));
    const last = parts[2] as { faqs: { question: string; answer: string }[] };
    last.faqs[0] = { question: last.faqs[0].question, answer: `<p>${"word ".repeat(1_100)}</p>` };
    modelWrites(message(planReply()), ...parts.map((part) => message(part)));
    await expect(job.handler({ event: { data: { runId: claim.runId } }, step: memoisedStep(), logger })).rejects.toMatchObject({
      name: "NonRetriableError",
      message: expect.stringContaining("The answer to question 1 is too long"),
    });
  });
});
