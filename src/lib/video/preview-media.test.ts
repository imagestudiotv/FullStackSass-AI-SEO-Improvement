import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { previewClip } = await import("./preview-media");
const { AI_HOOK_LIBRARY, AI_POV_LIBRARY } = await import("./footage/ai-library");
const { HOOK_LIBRARY } = await import("./footage/hook-library");

/** The clip an idea's preview plays before the video is made (client, 2026-11-21: the viral videos must show on the dashboard). */
describe("an idea's preview clip", () => {
  const aiUrl = (id: string) => `https://storage.example/shared/ai-clips/${id}.mp4`;
  const base = { direction: "meme" as const, pacing: "medium" as const, captionStyle: "bold" as const, musicMood: null, scenes: [], recipe: "r" };

  it("plays a POV clip video's AI clip for its whole length", () => {
    const clip = AI_POV_LIBRARY[0];
    expect(previewClip({ ...base, povClip: { id: clip.id, mirror: true, zoom: 1.05, hue: 3 } }, aiUrl, new Map())).toEqual({ url: aiUrl(clip.id), kind: "video", source: "stock", durationMs: clip.durationMs });
  });

  it("plays the hook clip picked for the idea: an AI clip with its climax, or a Pixabay clip RepGet has stored", () => {
    const ai = AI_HOOK_LIBRARY[0];
    expect(previewClip({ ...base, hookClip: { type: ai.type, pick: { provider: "ai", id: ai.id } } }, aiUrl, new Map())).toMatchObject({ url: aiUrl(ai.id), climaxMs: ai.climaxMs });
    const stock = HOOK_LIBRARY[0];
    const stored = new Map([[stock.id, { url: "https://storage.example/shared/stock/pixabay/x.mp4", durationMs: 12000 }]]);
    expect(previewClip({ ...base, hookClip: { type: stock.type, pick: { provider: "pixabay", id: stock.id } } }, aiUrl, stored)).toMatchObject({ url: "https://storage.example/shared/stock/pixabay/x.mp4", durationMs: 12000, climaxMs: stock.climaxMs });
    // Not stored yet: the placeholder stays.
    expect(previewClip({ ...base, hookClip: { type: stock.type, pick: { provider: "pixabay", id: stock.id } } }, aiUrl, new Map())).toBeNull();
  });

  it("has none without a pick, or for a clip no longer in the library", () => {
    expect(previewClip({ ...base, hookClip: { type: "danger" } }, aiUrl, new Map())).toBeNull();
    expect(previewClip({ ...base, povClip: { id: "2026-01-01-pov-gone", mirror: false, zoom: 1, hue: 0 } }, aiUrl, new Map())).toBeNull();
    expect(previewClip(null, aiUrl, new Map())).toBeNull();
  });
});
