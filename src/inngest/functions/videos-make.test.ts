import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The make job's render on Vercel (2026-11-24): one that breaks is made once
 * more, within the budget and without another AI call; a video deleted
 * meanwhile stops there.
 */

const make = vi.hoisted(() => ({
  claimMaking: vi.fn(async () => ({ format: "reel" })),
  holdProductionBudget: vi.fn(),
  holdSecondRender: vi.fn(async () => true),
  isMaking: vi.fn(async () => true),
  prepareAssets: vi.fn(async () => ({ assets: 1, notes: [] })),
  prepareVoice: vi.fn(),
  chooseMusic: vi.fn(),
  reelProps: vi.fn(async () => ({})),
  coverRequest: vi.fn(() => ({})),
  hasRepgetMusic: vi.fn(() => false),
  recordRender: vi.fn(),
  storeCover: vi.fn(async () => null),
  storeNoMusicVersion: vi.fn(),
  finishMaking: vi.fn(async () => ({ autoAt: null })),
  failMaking: vi.fn(),
  makeCarousel: vi.fn(),
  makeNoMusicVersion: vi.fn(),
  makeReelLocally: vi.fn(),
  ProductionError: class extends Error {},
}));
vi.mock("@/lib/video/make", () => make);
const render = vi.hoisted(() => ({
  onVercel: () => true,
  startReelRender: vi.fn(async () => ({ sandboxId: "s", startedAt: 1, vcpus: 4 })),
  reelRenderProgress: vi.fn(),
  stopRender: vi.fn(),
  collectRender: vi.fn(async () => ({ video: Buffer.from(""), noMusic: null, noMusicError: null, cover: null, coverError: null, runtimeMs: 1000, vcpus: 4 })),
}));
vi.mock("@/lib/video/render", () => render);
vi.mock("@/lib/video/storage", () => ({ storeVideoFile: vi.fn(async () => "https://files.example/v.mp4") }));
vi.mock("@/lib/db", () => ({ db: { select: () => ({ from: () => ({ where: async () => [{ id: "idea", websiteId: "w", platforms: [], status: "making" }] }) }) } }));
vi.mock("@/inngest/client", () => ({ inngest: { createFunction: (_options: unknown, handler: unknown) => handler } }));

import { makeVideo } from "./videos-make";

const names: string[] = [];
const step = {
  run: async (name: string, work: () => unknown) => {
    // As Inngest: a step name is one step.
    expect(names).not.toContain(name);
    names.push(name);
    return work();
  },
  sleep: async (name: string) => {
    expect(names).not.toContain(name);
    names.push(name);
  },
  sendEvent: vi.fn(),
};
const run = () =>
  (makeVideo as unknown as (context: unknown) => Promise<{ outcome: string }>)({
    event: { data: { ideaId: "idea" } },
    step,
    runId: "run_1",
    logger: { info: vi.fn(), warn: vi.fn() },
  });

beforeEach(() => {
  names.length = 0;
  vi.clearAllMocks();
  make.isMaking.mockResolvedValue(true);
  make.holdSecondRender.mockResolvedValue(true);
});

describe("a reel's render", () => {
  it("that breaks is made once more, on the same voice and pictures", async () => {
    render.reelRenderProgress.mockResolvedValueOnce({ stage: "error", message: "The machine stopped" }).mockResolvedValueOnce({ stage: "done" });
    expect(await run()).toEqual({ outcome: "ready" });
    expect(render.startReelRender).toHaveBeenCalledTimes(2);
    expect(render.stopRender).toHaveBeenCalledTimes(1);
    expect(make.recordRender).toHaveBeenCalledTimes(2);
    expect(make.prepareVoice).toHaveBeenCalledTimes(1);
    expect(make.prepareAssets).toHaveBeenCalledTimes(1);
    expect(make.finishMaking).toHaveBeenCalledTimes(1);
    // The first attempt's steps keep their names; the second has its own.
    expect(names).toEqual(expect.arrayContaining(["start-render", "check-1", "stop-render", "start-render-again", "check-1-again", "collect"]));
  });

  it("that breaks twice, or has no budget left, fails for good", async () => {
    render.reelRenderProgress.mockResolvedValue({ stage: "error", message: "The machine stopped" });
    await expect(run()).rejects.toMatchObject({ name: "NonRetriableError", message: "The machine stopped" });
    expect(render.startReelRender).toHaveBeenCalledTimes(2);
    expect(make.finishMaking).not.toHaveBeenCalled();

    names.length = 0;
    render.startReelRender.mockClear();
    make.holdSecondRender.mockResolvedValue(false);
    await expect(run()).rejects.toMatchObject({ message: "The machine stopped" });
    expect(render.startReelRender).toHaveBeenCalledTimes(1);
  });

  it("stops when its video is deleted, and a deleted one is not started", async () => {
    render.reelRenderProgress.mockResolvedValue({ stage: "working", progress: 0.1 });
    let checks = 0;
    // Five steps before the render's first check ask first.
    make.isMaking.mockImplementation(async () => (checks += 1) <= 5);
    expect(await run()).toEqual({ outcome: "deleted" });
    expect(render.stopRender).toHaveBeenCalledTimes(1);
    expect(make.finishMaking).not.toHaveBeenCalled();

    names.length = 0;
    make.isMaking.mockResolvedValue(false);
    make.prepareVoice.mockClear();
    await expect(run()).rejects.toMatchObject({ name: "NonRetriableError" });
    expect(make.prepareVoice).not.toHaveBeenCalled();
  });
});
