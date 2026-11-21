import { describe, expect, it } from "vitest";

import type { AiHookClip } from "@/lib/video/footage/ai-library";

import { formatSeconds, formatUsd, summarizeClips } from "./summary";

/** Admin -> AI clips' figures (client, 2026-11-19): counts, spend, batches. */

const clip = (id: string, madeOn: string, type: AiHookClip["type"], costUsd = 0.56): AiHookClip => ({
  id,
  type,
  tags: ["test"],
  climaxMs: 5500,
  durationMs: 8000,
  prompt: "A test prompt",
  costUsd,
  madeOn,
});

describe("summarizeClips", () => {
  const now = new Date("2026-11-19T12:00:00Z");

  it("answers an empty library with zeros and no batches", () => {
    const summary = summarizeClips([], now);
    expect(summary).toMatchObject({ count: 0, totalUsd: 0, monthCount: 0, monthUsd: 0, month: "2026-11", batches: [] });
    expect(summary.byType).toEqual({ anticipation: 0, impossible: 0, danger: 0, pov: 0 });
  });

  it("counts the clips, their cost, this UTC month's and each hook type", () => {
    const summary = summarizeClips(
      [
        clip("2026-10-30-a", "2026-10-30", "danger", 0.1),
        clip("2026-11-19-a", "2026-11-19", "anticipation", 0.2),
        clip("2026-11-19-b", "2026-11-19", "impossible", 0.56),
        clip("2026-11-02-a", "2026-11-02", "anticipation", 0.56),
      ],
      now,
    );
    expect(summary.count).toBe(4);
    expect(summary.totalUsd).toBe(1.42);
    expect(summary.monthCount).toBe(3);
    expect(summary.monthUsd).toBe(1.32);
    expect(summary.byType).toEqual({ anticipation: 2, impossible: 1, danger: 1, pov: 0 });
  });

  it("groups batches by day, newest first, keeping the library's order inside one", () => {
    const summary = summarizeClips(
      [
        clip("old", "2026-10-30", "danger"),
        clip("new-1", "2026-11-19", "anticipation", 0.1),
        clip("mid", "2026-11-02", "impossible"),
        clip("new-2", "2026-11-19", "danger", 0.2),
      ],
      now,
    );
    expect(summary.batches.map((batch) => batch.madeOn)).toEqual(["2026-11-19", "2026-11-02", "2026-10-30"]);
    expect(summary.batches[0].clips.map((c) => c.id)).toEqual(["new-1", "new-2"]);
    expect(summary.batches[0].costUsd).toBe(0.3);
  });

  it("counts a take paid for but not kept in the spend, not in the clips", () => {
    const summary = summarizeClips([clip("2026-11-19-a", "2026-11-19", "danger")], now, [{ id: "2026-11-19-b", madeOn: "2026-11-19", costUsd: 0.56, why: "too small" }, { id: "2026-11-18-c", madeOn: "2026-11-18", costUsd: 0.56, why: "odd hands" }]);
    expect(summary.count).toBe(1);
    expect(summary.rejected).toBe(2);
    expect(summary.totalUsd).toBe(1.68);
    expect(summary.monthUsd).toBe(1.68);
    expect(summary.batches.map((batch) => [batch.madeOn, batch.clips.length, batch.rejected, batch.costUsd])).toEqual([
      ["2026-11-19", 1, 1, 1.12],
      ["2026-11-18", 0, 1, 0.56],
    ]);
  });

  it("counts POV clips (client, 2026-11-21) next to the hook types", () => {
    const pov = { id: "2026-11-21-pov-a", type: "pov" as const, costUsd: 0.7, madeOn: "2026-11-21" };
    const summary = summarizeClips([clip("2026-11-19-a", "2026-11-19", "danger"), pov], now);
    expect(summary.byType).toEqual({ anticipation: 0, impossible: 0, danger: 1, pov: 1 });
    expect(summary.totalUsd).toBe(1.26);
    expect(summary.batches.map((batch) => batch.madeOn)).toEqual(["2026-11-21", "2026-11-19"]);
  });

  it("does not count the same month of another year as this month", () => {
    expect(summarizeClips([clip("x", "2025-11-19", "danger")], now).monthCount).toBe(0);
  });
});

describe("formatting", () => {
  it("shows dollars with cents and lengths in seconds", () => {
    expect(formatUsd(5.6)).toBe("$5.60");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatSeconds(8000)).toBe("8 s");
    expect(formatSeconds(5500)).toBe("5.5 s");
  });
});
