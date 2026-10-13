import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The index-articles job's wiring: off without a key, otherwise queue, send,
 * check - and each newly indexed article announced once.
 */

vi.mock("@/inngest/client", () => ({
  inngest: { createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) },
}));
const run = vi.hoisted(() => ({
  queueNewlyLive: vi.fn(),
  submitQueued: vi.fn(),
  checkSubmitted: vi.fn(),
  announceIndexed: vi.fn(),
}));
vi.mock("@/lib/indexing/run", () => run);

import { indexArticles } from "./index-articles";

type Fn = { config: { triggers: unknown[]; concurrency: unknown }; handler: (ctx: unknown) => Promise<unknown> };
const job = indexArticles as unknown as Fn;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const step = { run: async (_id: string, fn: () => unknown) => fn() };

beforeEach(() => {
  delete process.env.SPEEDYINDEX_API_KEY;
  for (const fn of Object.values(run)) fn.mockReset();
});

describe("index-articles", () => {
  it("runs every two hours, one run at a time", () => {
    expect(job.config.triggers).toEqual([{ cron: "20 */2 * * *" }]);
    expect(job.config.concurrency).toEqual({ limit: 1 });
  });

  it("does nothing without SPEEDYINDEX_API_KEY", async () => {
    expect(await job.handler({ step, logger })).toEqual({ configured: false });
    expect(run.queueNewlyLive).not.toHaveBeenCalled();
    expect(run.submitQueued).not.toHaveBeenCalled();
  });

  it("queues, sends and checks; announces each newly indexed article", async () => {
    process.env.SPEEDYINDEX_API_KEY = "test-key-not-real";
    run.queueNewlyLive.mockResolvedValue(2);
    run.submitQueued.mockResolvedValue({ sent: 2, held: 0, skipped: 0, failed: 0, taskId: "t1" });
    const indexed = { id: "r1", articleId: "a1", websiteId: "w1", organizationId: "o1", title: "T", url: "https://a.test/" };
    run.checkSubmitted.mockResolvedValue({ tasks: 1, indexed: [indexed], notIndexed: 0 });

    const result = await job.handler({ step, logger });
    expect(result).toMatchObject({ configured: true, queued: 2, submitted: { sent: 2 }, checked: { tasks: 1, indexed: 1 } });
    expect(run.announceIndexed).toHaveBeenCalledTimes(1);
    expect(run.announceIndexed).toHaveBeenCalledWith(indexed);
  });
});
