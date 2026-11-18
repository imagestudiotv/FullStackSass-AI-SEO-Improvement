import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductionReelProps } from "@/remotion/props";

/**
 * The cover still is made on the reel's own render machine before it stops,
 * without captions, at the frame asked for - and it is a bonus: a cover that
 * fails or hangs never costs the video (the machine and the providers are
 * fakes here; nothing is rendered).
 */

const fakes = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  stop: vi.fn(async () => undefined),
  still: vi.fn(),
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: vi.fn(async () => ({
      readFileToBuffer: async ({ path }: { path: string }) => fakes.files.get(path) ?? null,
      stop: fakes.stop,
    })),
  },
}));
vi.mock("@remotion/vercel", () => ({ renderStillOnVercel: fakes.still }));

import { collectRender, coverProps, withTimeout } from "./render";

const PROPS = { style: "bold", captions: true, words: [{ text: "A", startMs: 0, endMs: 200 }] } as unknown as ProductionReelProps;
const HANDLE = { sandboxId: "sbx_1", cmdId: "cmd_1", startedAt: Date.now() - 120_000, vcpus: 4 };

afterEach(() => {
  fakes.files.clear();
  fakes.stop.mockClear();
  fakes.still.mockReset();
});

describe("the reel's cover still", () => {
  it("is rendered on the same machine at the cover frame, captions hidden, before the machine stops", async () => {
    fakes.files.set("/tmp/reel.mp4", Buffer.from("video"));
    fakes.still.mockImplementation(async ({ outputFile }: { outputFile: string }) => {
      fakes.files.set(outputFile, Buffer.from("jpeg"));
      return { sandboxFilePath: outputFile, contentType: "image/jpeg" };
    });
    const result = await collectRender(HANDLE, null, { props: PROPS, frame: 42 });
    expect(result.video.toString()).toBe("video");
    expect(result.cover?.toString()).toBe("jpeg");
    expect(result.coverError).toBeNull();
    const call = fakes.still.mock.calls[0][0];
    expect(call).toMatchObject({ compositionId: "Reel", frame: 42, imageFormat: "jpeg" });
    expect(call.inputProps).toMatchObject({ hideCaptions: true, captions: true });
    expect(fakes.stop).toHaveBeenCalledTimes(1);
    // Its seconds are in the render's runtime (the cost ledger's measured sandbox time).
    expect(result.runtimeMs).toBeGreaterThanOrEqual(120_000);
  });

  it("never fails the video: a refused still leaves the video and says why", async () => {
    fakes.files.set("/tmp/reel.mp4", Buffer.from("video"));
    fakes.still.mockRejectedValue(new Error("Render still failed: delayRender() timed out"));
    const result = await collectRender(HANDLE, null, { props: PROPS, frame: 42 });
    expect(result.video.toString()).toBe("video");
    expect(result.cover).toBeNull();
    expect(result.coverError).toMatch(/delayRender/);
    expect(fakes.stop).toHaveBeenCalledTimes(1);
  });

  it("is not made when not asked for (a reel collected as before)", async () => {
    fakes.files.set("/tmp/reel.mp4", Buffer.from("video"));
    const result = await collectRender(HANDLE, null);
    expect(fakes.still).not.toHaveBeenCalled();
    expect(result).toMatchObject({ cover: null, coverError: null });
  });

  it("is given up when it hangs", async () => {
    vi.useFakeTimers();
    try {
      const hung = withTimeout(new Promise<never>(() => undefined), 60_000, "The cover took too long");
      const expectation = expect(hung).rejects.toThrow("The cover took too long");
      await vi.advanceTimersByTimeAsync(60_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the reel's own props, only without captions", () => {
    expect(coverProps(PROPS)).toEqual({ ...PROPS, hideCaptions: true });
  });
});
