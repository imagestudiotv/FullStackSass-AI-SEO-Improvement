import { describe, expect, it } from "vitest";

import { AI_HOOK_LIBRARY, AI_POV_LIBRARY, AI_REJECTED_TAKES, povClipById } from "./ai-library";

/** RepGet's AI POV clips (client, 2026-11-21: "similar videos, of course without text"). */
describe("the AI POV clips", () => {
  it("are checked 10-second clips, each with what it shows for the idea writer", () => {
    const ids = AI_POV_LIBRARY.map((clip) => clip.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const clip of AI_POV_LIBRARY) {
      expect(clip.id).toMatch(/^\d{4}-\d{2}-\d{2}-pov-[a-z0-9-]+$/);
      expect(clip.id.startsWith(clip.madeOn)).toBe(true);
      expect(clip.durationMs).toBe(10_000);
      expect(clip.costUsd).toBeGreaterThan(0);
      expect(clip.shows.length).toBeGreaterThan(30);
      expect(clip.tags.length).toBeGreaterThan(2);
      // Made without text: the customer's POV line goes on top.
      expect(clip.prompt).toMatch(/no text/i);
      expect(povClipById(clip.id)).toBe(clip);
    }
  });

  it("never share an id with a hook clip or a take that was not kept", () => {
    const hooks = new Set(AI_HOOK_LIBRARY.map((clip) => clip.id));
    const rejected = new Set(AI_REJECTED_TAKES.map((take) => take.id));
    for (const clip of AI_POV_LIBRARY) {
      expect(hooks.has(clip.id)).toBe(false);
      expect(rejected.has(clip.id)).toBe(false);
    }
    expect(povClipById("2026-11-21-pov-smug-hamster")).toBeNull();
  });
});
