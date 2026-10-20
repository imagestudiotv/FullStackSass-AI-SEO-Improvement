import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blogAutopilot, blogAutopilotRuns, blogAutopilotTopics, blogPosts, jobOutbox } from "@/lib/db/schema";
import { message, partReplies, planReply } from "@/test/blog-autopilot";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The blog autopilot's job from start to finish, on a real (in-process)
 * database with the model, the pictures and email mocked: a topic becomes an
 * English draft with every field and its pictures, then a linked draft in
 * each chosen language with its own pictures, and the administrators are
 * told; a failure retries only the step that failed; what still fails on its
 * last try is listed, never stopping the rest; and a run that cannot finish
 * hands its topic back.
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
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5", BLOG: "claude-sonnet-5", BLOG_TRANSLATION: "claude-haiku-5-5" },
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

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: mail.send }));

import { startAutopilotRun } from "@/lib/blog/autopilot/run";
import { bodyParts } from "@/lib/blog/autopilot/write";

import { blogAutopilotRun, blogAutopilotSchedule } from "./blog-autopilot";

type Handler = (input: unknown) => Promise<unknown>;
type Job = { config: { onFailure: Handler; concurrency: unknown; triggers: unknown }; handler: Handler };
const job = blogAutopilotRun as unknown as Job;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let test: TestDb;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  vi.stubEnv("ADMIN_EMAILS", "admin@repget.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(blogAutopilotRuns);
  await test.db.delete(blogAutopilotTopics);
  await test.db.delete(blogPosts);
  await test.db.delete(jobOutbox);
  await test.db.delete(blogAutopilot);
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: ["evt"] });
  ai.stream.mockReset();
  images.generate.mockReset();
  images.generate.mockImplementation(async () => ({ data: await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#fff" } }).png().toBuffer(), costUsd: 0.19 }));
  images.configured.mockReturnValue(true);
  images.stored.length = 0;
  mail.send.mockReset();
  mail.send.mockResolvedValue({ ok: true, id: "email" });
  failing.clear();
  // Translator calls are answered by translating(); the writer's answers are queued per test (modelWrites).
  ai.stream.mockImplementation((params: Params) => ({ finalMessage: async () => translating(params) }));
});

type Params = { system: { text: string }[]; messages: { content: string }[] };
const CODES: Record<string, string> = { Spanish: "es", French: "fr", Italian: "it", German: "de" };
/** Languages whose fields fail, to see what happens when a translation cannot be made. */
const failing = new Set<string>();
const inside = (text: string, tag: string) => text.slice(text.indexOf(`<${tag}>\n`) + tag.length + 3, text.lastIndexOf(`\n</${tag}>`));

/** A translator that marks every text with the language and keeps the HTML, as the real one must. */
function translating(params: Params) {
  const language = /from English into (\w+)\./.exec(params.system[0].text)?.[1];
  if (!language) throw new Error("an unexpected writer call: queue its answer with modelWrites");
  const code = CODES[language];
  const request = params.messages[0].content;
  if (request.includes("<html_part>")) {
    return message({ bodyHtml: inside(request, "html_part").replace(/>([^<]+)</g, (_m, words: string) => `>[${code}] ${words}<`) });
  }
  if (failing.has(code)) throw new Error("overloaded_error");
  const source = JSON.parse(inside(request, "article_json"));
  const mark = (value: string) => (value ? `[${code}] ${value}` : "");
  return message({
    title: mark(source.title),
    slug: `${code} ${source.title}`,
    seoTitle: mark(source.seoTitle),
    description: mark(source.description),
    shortAnswer: mark(source.shortAnswer),
    breadcrumbLabel: mark(source.breadcrumbLabel),
    primaryKeyword: mark(source.primaryKeyword),
    secondaryKeywords: source.secondaryKeywords.map(mark),
    faqs: source.faqs.map((faq: { question: string; answer: string }) => ({ question: mark(faq.question), answer: faq.answer.replace("<p>", `<p>[${code}] `) })),
    pictures: source.pictures.map((picture: { title: string; labels: string[]; alt: string }) => ({
      title: mark(picture.title),
      labels: picture.labels.map(mark),
      alt: mark(picture.alt),
    })),
  });
}

/** English only, unless a test chooses languages. */
async function languages(...chosen: string[]) {
  await test.db.insert(blogAutopilot).values({ key: "blog", languages: chosen });
}


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

/** One invocation, as Inngest makes it: `attempt` 2 of 3 is a step's last try. */
const invoke = (runId: string, step: unknown, attempt = 0) => job.handler({ event: { data: { runId } }, step, logger, attempt, maxAttempts: 3 });

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
    await languages();
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const step = memoisedStep();
    const result = (await invoke(claim.runId, step)) as { written: boolean; postId: string };

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
      "languages",
      "english-source",
      "finish-run",
      "email-admins",
    ]);
    // One plan and three parts, all asking Sonnet 5 with the same instructions, so the cache serves the later calls.
    expect(ai.stream).toHaveBeenCalledTimes(4);
    const systems = ai.stream.mock.calls.map(([params]) => JSON.stringify((params as { system: unknown }).system));
    expect(new Set(systems).size).toBe(1);
    for (const [params] of ai.stream.mock.calls) expect(params).toMatchObject({ model: "claude-sonnet-5", output_config: { effort: "high" } });

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
    expect(detail.model).toBe("claude-sonnet-5");
    expect((detail as unknown as { translationModel: string }).translationModel).toBe("claude-haiku-5-5");
    expect(detail.usage.calls).toBe(4);
    // At Sonnet 5's prices: the plan writes the cache ($2.50/M); the parts read it ($0.20/M).
    expect(detail.usage.costUsd).toBeCloseTo((4_000 * 2 + 8_000 * 10 + 20_000 * 2.5 + 60_000 * 0.2) / 1_000_000, 4);
    expect(detail.words).toBeGreaterThan(3_200);
    expect(detail.pictures).toHaveLength(2);
    expect(detail.picturesMade).toBe(2);
    expect(detail.warnings).toEqual([]);
    expect(detail.costs).toMatchObject({ "picture-en-1": 0.19, "picture-en-2": 0.19 });
    expect(Object.keys(detail.costs)).toEqual(expect.arrayContaining(["plan-article", "write-part-1", "write-part-2", "write-part-3"]));
  });

  it("retries only the step that failed: the plan and the parts already written are not paid for twice", async () => {
    await languages();
    const claim = await queuedRun();
    const [plan, part1, , part3] = WHOLE_ARTICLE();
    const part2 = partReplies(bodyParts(10))[1];
    modelWrites(plan, part1);
    ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => Promise.reject(new Error("overloaded_error")) }));
    const step = memoisedStep();
    await expect(invoke(claim.runId, step)).rejects.toThrow("overloaded_error");

    modelWrites(message(part2), part3);
    await invoke(claim.runId, step);
    expect(ai.stream).toHaveBeenCalledTimes(5);
    expect(step.ran.filter((id) => id === "plan-article")).toHaveLength(1);
    expect(await test.db.select().from(blogPosts)).toHaveLength(1);
  });

  it("tries a picture again, and saves the article without it when its last try fails, saying which one to add by hand", async () => {
    await languages();
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const step = memoisedStep();
    images.generate.mockRejectedValueOnce(new Error("Image provider rejected the request (400): content policy"));
    // Not the last try: thrown, so Inngest tries the step again.
    await expect(invoke(claim.runId, step)).rejects.toThrow("content policy");
    images.generate.mockRejectedValueOnce(new Error("Image provider rejected the request (400): content policy"));
    const result = (await invoke(claim.runId, step, 2)) as { postId: string };
    const [post] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, result.postId));
    expect(post.bodyHtml.match(/<img /g)).toHaveLength(1);
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect(run.status).toBe("done");
    expect((run.detail as { warnings: string[] }).warnings).toEqual([
      'Picture 1 ("From search to call") could not be made: Image provider rejected the request (400): content policy. Add one by hand if the section needs it.',
    ]);
  });

  it("writes the article without pictures where they are not set up, and says so", async () => {
    await languages();
    images.configured.mockReturnValue(false);
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const result = (await invoke(claim.runId, memoisedStep())) as { postId: string };
    const [post] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, result.postId));
    expect(post.bodyHtml).not.toContain("<img");
    expect(images.generate).not.toHaveBeenCalled();
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect((run.detail as { warnings: string[] }).warnings).toEqual([
      "Pictures are not set up on this server (an OpenAI image key and image storage), so the articles have none.",
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
    expect(await invoke(claim.runId, memoisedStep())).toEqual({ written: false });
    expect(ai.stream).not.toHaveBeenCalled();
  });

  it("does not retry an article that breaks the blog's rules", async () => {
    await languages();
    const claim = await queuedRun();
    const parts = partReplies(bodyParts(10));
    const last = parts[2] as { faqs: { question: string; answer: string }[] };
    last.faqs[0] = { question: last.faqs[0].question, answer: `<p>${"word ".repeat(1_100)}</p>` };
    modelWrites(message(planReply()), ...parts.map((part) => message(part)));
    await expect(invoke(claim.runId, memoisedStep())).rejects.toMatchObject({
      name: "NonRetriableError",
      message: expect.stringContaining("The answer to question 1 is too long"),
    });
  });

  it("then writes every chosen language as a linked draft with its own pictures, and emails the administrators", async () => {
    // No settings saved: every language (Spanish, French, Italian, German).
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const step = memoisedStep();
    const result = (await invoke(claim.runId, step)) as { postId: string; translations: number };
    expect(result.translations).toBe(4);
    expect(step.ran.filter((id) => id.startsWith("translate-it") || id.startsWith("picture-it") || id === "save-it")).toEqual([
      "translate-it-fields",
      "translate-it-part-1",
      "translate-it-part-2",
      "translate-it-part-3",
      "picture-it-1",
      "picture-it-2",
      "save-it",
    ]);
    // 4 to write it, then 4 per language (the fields and the body's three parts).
    expect(ai.stream).toHaveBeenCalledTimes(20);
    // Written by Sonnet 5, translated by Haiku 5.5 (client, 2026-10-20: for the cost).
    const models = ai.stream.mock.calls.map(([request]) => (request as { model: string }).model);
    expect(models.slice(0, 4)).toEqual(Array(4).fill("claude-sonnet-5"));
    expect(new Set(models.slice(4))).toEqual(new Set(["claude-haiku-5-5"]));
    expect(images.stored).toEqual(["posts/en", "posts/en", "posts/es", "posts/es", "posts/fr", "posts/fr", "posts/it", "posts/it", "posts/de", "posts/de"]);

    const posts = await test.db.select().from(blogPosts);
    expect(posts.map((post) => post.locale).sort()).toEqual(["de", "en", "es", "fr", "it"]);
    const italian = posts.find((post) => post.locale === "it")!;
    expect(italian).toMatchObject({
      translationOf: result.postId,
      needsReview: true,
      status: "draft",
      title: "[it] Local SEO for Plumbers: How to Get Found by Nearby Customers",
      slug: "it-local-seo-for-plumbers-how-to-get-found-by-nearby-customers",
      primaryKeyword: "[it] local SEO for plumbers",
      category: "Playbooks",
    });
    expect(italian.faqs).toHaveLength(6);
    expect((italian.bodyHtml.match(/<h2>/g) ?? []).length).toBe(10);
    // Its links lead to the Italian pages (client, 2026-10-20), not the English ones.
    expect(italian.bodyHtml).toContain('<a href="https://www.repget.com/it/audit">[it] free website audit</a>');
    expect(italian.bodyHtml).not.toContain('href="https://www.repget.com/audit"');
    expect(step.ran).toContain("links-it");
    // Its own pictures, with its own words; no English picture left in it.
    expect(
      images.generate.mock.calls.some(([prompt]) => String(prompt).includes('"[it] From search to call"') && String(prompt).includes("All text is in Italian")),
    ).toBe(true);
    expect(italian.bodyHtml).toMatch(/blog\/posts\/it\/\d+\.webp" alt="\[it\] How a local search becomes a call"/);
    expect(italian.bodyHtml).not.toContain("blog/posts/en/");

    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    const detail = run.detail as { translations: Record<string, string>; costs: Record<string, number>; warnings: string[] };
    expect(Object.keys(detail.translations).sort()).toEqual(["de", "es", "fr", "it"]);
    expect(detail.translations.it).toBe(italian.id);
    expect(detail.costs).toMatchObject({ "picture-it-1": 0.19, "picture-de-2": 0.19 });
    expect(Object.keys(detail.costs)).toEqual(expect.arrayContaining(["translate-it-fields", "translate-de-part-3"]));
    expect(detail.warnings).toEqual([]);
    expect(run.status).toBe("done");

    expect(mail.send).toHaveBeenCalledTimes(1);
    const [{ to, subject, text }] = mail.send.mock.calls[0];
    expect(to).toBe("admin@repget.test");
    expect(subject).toBe("Blog drafts to review: Local SEO for Plumbers: How to Get Found by Nearby Customers");
    expect(text).toContain("The English draft and its Spanish, French, Italian, German translations are ready to review.");
    expect(text).toContain(`Italian: https://www.repget.com/admin/blog/${italian.id}`);
    expect(text).toMatch(/AI cost: \$\d+\.\d\d\./);
  });

  it("lists a language that still fails on its last try, and saves the others", async () => {
    await languages("fr", "it");
    failing.add("fr");
    const claim = await queuedRun();
    modelWrites(...WHOLE_ARTICLE());
    const step = memoisedStep();
    // Not the last try: the French fields are tried again.
    await expect(invoke(claim.runId, step)).rejects.toThrow("overloaded_error");
    const result = (await invoke(claim.runId, step, 2)) as { translations: number };
    expect(result.translations).toBe(1);
    expect((await test.db.select().from(blogPosts)).map((post) => post.locale).sort()).toEqual(["en", "it"]);
    const [run] = await test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.id, claim.runId));
    expect(run.status).toBe("done");
    expect((run.detail as { warnings: string[] }).warnings).toEqual([
      'The French translation could not be made: overloaded_error. Use "Translate" on the English draft to make it.',
    ]);
    expect(mail.send.mock.calls[0][0].text).toContain("The English draft and its Italian translation are ready to review.");
    expect(mail.send.mock.calls[0][0].text).toContain("- The French translation could not be made");
  });
});

describe("the daily schedule", () => {
  const schedule = blogAutopilotSchedule as unknown as Job;
  const tick = (at: string) => {
    vi.setSystemTime(new Date(at));
    return schedule.handler({ step: memoisedStep(), logger }) as Promise<{ written: boolean; reason?: string; runId?: string }>;
  };
  const turnOn = (runHour = 6) => test.db.insert(blogAutopilot).values({ key: "blog", enabled: true, runHour, languages: [] });
  const scheduled = () => test.db.select().from(blogAutopilotRuns).where(eq(blogAutopilotRuns.trigger, "schedule"));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs every hour, writing nothing while the autopilot is off", async () => {
    expect(schedule.config.triggers).toEqual([{ cron: "5 * * * *" }]);
    await test.db.insert(blogAutopilotTopics).values({ topic: "Waiting", sortOrder: 1 });
    expect(await tick("2026-10-17T06:05:00Z")).toEqual({ written: false, reason: "off" });
    expect(await scheduled()).toHaveLength(0);
  });

  it("starts the day's article once the hour has come, once a day", async () => {
    await turnOn(6);
    await test.db.insert(blogAutopilotTopics).values([
      { topic: "First", sortOrder: 1 },
      { topic: "Second", sortOrder: 2 },
    ]);
    expect(await tick("2026-10-17T05:05:00Z")).toEqual({ written: false, reason: "before-the-hour" });
    const started = await tick("2026-10-17T06:05:00Z");
    expect(started.written).toBe(true);
    const [run] = await scheduled();
    expect(run).toMatchObject({ id: started.runId, runDate: "2026-10-17", status: "running" });
    expect(inngestMock.send).toHaveBeenCalledWith(expect.objectContaining({ name: "blog/autopilot.run", data: { runId: started.runId } }));
    // The run ends; later ticks that day write nothing more.
    await test.db.update(blogAutopilotRuns).set({ status: "done" });
    await test.db.update(blogAutopilotTopics).set({ status: "written" }).where(eq(blogAutopilotTopics.topic, "First"));
    expect(await tick("2026-10-17T07:05:00Z")).toEqual({ written: false, reason: "done-today" });
    expect(await tick("2026-10-17T23:05:00Z")).toEqual({ written: false, reason: "done-today" });
    // The next day, the next topic.
    expect((await tick("2026-10-18T06:05:00Z")).written).toBe(true);
    expect((await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.topic, "Second")))[0].status).toBe("writing");
  });

  it("writes it later that day when the hour was missed or an article was being written", async () => {
    await turnOn(6);
    await test.db.insert(blogAutopilotTopics).values([
      { topic: "By hand", sortOrder: 1, status: "writing" },
      { topic: "Scheduled", sortOrder: 2 },
    ]);
    expect(await tick("2026-10-17T06:05:00Z")).toEqual({ written: false, reason: "busy" });
    await test.db.update(blogAutopilotTopics).set({ status: "written" }).where(eq(blogAutopilotTopics.topic, "By hand"));
    expect((await tick("2026-10-17T09:05:00Z")).written).toBe(true);
  });

  it("records a day with nothing to write, with the reason, and does not try again every hour", async () => {
    await turnOn(6);
    // An empty list and no search data to choose topics from.
    expect(await tick("2026-10-17T06:05:00Z")).toEqual({ written: false, reason: "empty" });
    const [day] = await scheduled();
    expect(day).toMatchObject({ runDate: "2026-10-17", status: "failed" });
    expect(day.error).toBe(
      "Nothing was written today: the topic list is empty. Search data is not set up on this server, so RepGet cannot choose topics. Add topics to the list instead.",
    );
    expect(await tick("2026-10-17T07:05:00Z")).toEqual({ written: false, reason: "done-today" });
    expect(await scheduled()).toHaveLength(1);
  });

  it("fails runs that stopped without finishing, so their topic can be tried again", async () => {
    await test.db.insert(blogAutopilotTopics).values({ topic: "Stuck", sortOrder: 1, status: "writing" });
    const [topic] = await test.db.select().from(blogAutopilotTopics);
    await test.db.insert(blogAutopilotRuns).values({ runDate: "2026-10-17", trigger: "manual", topicId: topic.id, status: "running", startedAt: new Date("2026-10-17T02:00:00Z") });
    await test.db.insert(blogAutopilotRuns).values({ runDate: "2026-10-17", trigger: "manual", status: "running", startedAt: new Date("2026-10-17T04:30:00Z") });
    await tick("2026-10-17T06:05:00Z");
    const runs = await test.db.select().from(blogAutopilotRuns).orderBy(blogAutopilotRuns.startedAt);
    expect(runs.map((run) => run.status)).toEqual(["failed", "running"]);
    expect(runs[0].error).toBe("The writing stopped without finishing. Try again.");
    expect((await test.db.select().from(blogAutopilotTopics))[0]).toMatchObject({ status: "failed", error: "The writing stopped without finishing. Try again." });
  });
});
