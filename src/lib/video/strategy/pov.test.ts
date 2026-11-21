import { describe, expect, it } from "vitest";

import type { IdeaCategory, VideoFormat } from "../formats";
import type { AiHookClip, AiPovClip } from "../footage/ai-library";
import type { HookLibraryClip } from "../footage/hook-library";
import { opensOnAiClip } from "../footage/hooks";
import { stableHash } from "./creative";
import { hookPick, pickPovClip, POV_LENGTH, povLook, povScript, povSlots } from "./pov";
import { ideaSchema, systemPrompt, type IdeaInput, type SlotBrief } from "./prompt";

/**
 * POV clip videos and hook clips chosen when the idea is written (client,
 * 2026-11-21: "POV clip: 5, others: 5"; AI:Pixabay 70:30).
 */

const pov = (id: string, shows: string, tags: string[]): AiPovClip => ({ id, shows, tags, durationMs: 10_000, prompt: "p", costUsd: 0.7, madeOn: "2026-11-21" });

const POV_LIBRARY: AiPovClip[] = [
  pov("2026-11-21-pov-cat-phone", "A cartoon cat stares at a ringing phone in disbelief.", ["phone", "call", "surprise"]),
  pov("2026-11-21-pov-dog-sofa", "A cartoon dog lies on a sofa while notifications pile up.", ["relax", "sofa", "bookings", "lazy"]),
  pov("2026-11-21-pov-owl-croissant", "A cartoon owl proudly holds up a giant croissant.", ["bakery", "croissant", "proud", "food"]),
  pov("2026-11-21-pov-frog-queue", "A cartoon frog watches a long queue form outside a shop.", ["queue", "shop", "customers", "busy"]),
];

const slots = (formats: VideoFormat[], category: IdeaCategory = "viral") => formats.map((format) => ({ category, format }));

describe("POV clip slots", () => {
  it("are half of the viral reels and Stories, the first one included", () => {
    const flags = povSlots(slots(Array.from({ length: 10 }, (_, i): VideoFormat => (i === 8 ? "story" : "reel"))), POV_LIBRARY);
    expect(flags.filter(Boolean)).toHaveLength(5);
    expect(flags).toEqual([true, false, true, false, true, false, true, false, true, false]);
  });

  it("are never a carousel or a non-viral idea, and none without clips", () => {
    const mixed = [
      { category: "viral" as const, format: "carousel" as const },
      { category: "viral" as const, format: "reel" as const },
      { category: "educational" as const, format: "reel" as const },
      { category: "viral" as const, format: "carousel" as const },
      { category: "viral" as const, format: "story" as const },
      { category: "viral" as const, format: "reel" as const },
    ];
    expect(povSlots(mixed, POV_LIBRARY)).toEqual([false, true, false, false, false, true]);
    expect(povSlots(slots(["carousel", "carousel"]), POV_LIBRARY)).toEqual([false, false]);
    expect(povSlots(slots(["reel", "reel", "story"]), [])).toEqual([false, false, false]);
  });

  it("have a script of the POV line and the closing line only", () => {
    expect(povScript({ hook: `  POV: ${"x".repeat(200)}`, cta: "Follow us" })).toEqual({ hook: `POV: ${"x".repeat(85)}`, points: [], proof: "", cta: "Follow us" });
    expect(povScript({ hook: "   ", cta: "Follow us" })).toBeNull();
    expect(POV_LENGTH.points).toEqual({ min: 0, max: 0 });
  });
});

describe("the POV clip of an idea", () => {
  it("is the writer's choice when it is in the library and still free", () => {
    expect(pickPovClip("2026-11-21-pov-dog-sofa", "POV: anything", new Set(), 0, POV_LIBRARY)).toBe("2026-11-21-pov-dog-sofa");
  });

  it("else the free clip that matches the line best", () => {
    const line = "POV: ChatGPT just told locals your bakery has the best croissants";
    expect(pickPovClip("made-up-id", line, new Set(), 3, POV_LIBRARY)).toBe("2026-11-21-pov-owl-croissant");
    expect(pickPovClip(null, line, new Set(), 3, POV_LIBRARY)).toBe("2026-11-21-pov-owl-croissant");
    // Taken already in this batch: the writer's choice and the best match make way.
    expect(pickPovClip("2026-11-21-pov-owl-croissant", line, new Set(["2026-11-21-pov-owl-croissant"]), 3, POV_LIBRARY)).not.toBe("2026-11-21-pov-owl-croissant");
  });

  it("never repeats in a batch while a free one is left, and rotates equals by the seed", () => {
    const used = new Set<string>();
    for (let i = 0; i < POV_LIBRARY.length; i++) {
      const id = pickPovClip("2026-11-21-pov-cat-phone", "POV: nothing in common", used, i, POV_LIBRARY)!;
      expect(used.has(id)).toBe(false);
      used.add(id);
    }
    expect(used.size).toBe(POV_LIBRARY.length);
    // All used: still a clip.
    expect(POV_LIBRARY.map((clip) => clip.id)).toContain(pickPovClip(null, "POV: x", used, 7, POV_LIBRARY));
    const firsts = new Set(Array.from({ length: 8 }, (_, seed) => pickPovClip(null, "POV: nothing in common", new Set(), seed, POV_LIBRARY)));
    expect(firsts.size).toBe(POV_LIBRARY.length);
  });

  it("is none on an empty library", () => {
    expect(pickPovClip("2026-11-21-pov-cat-phone", "POV: x", new Set(), 0, [])).toBeNull();
  });

  it("gets a look of its own, fixed per idea", () => {
    const looks = Array.from({ length: 2000 }, (_, i) => povLook(stableHash(`idea-${i}`)));
    for (const look of looks) {
      expect(look.zoom).toBeGreaterThanOrEqual(1);
      expect(look.zoom).toBeLessThanOrEqual(1.12);
      expect(Number(look.zoom.toFixed(2))).toBe(look.zoom);
      expect(Number.isInteger(look.hue)).toBe(true);
      expect(look.hue).toBeGreaterThanOrEqual(-8);
      expect(look.hue).toBeLessThanOrEqual(8);
    }
    const mirrored = looks.filter((look) => look.mirror).length / looks.length;
    expect(mirrored).toBeGreaterThan(0.45);
    expect(mirrored).toBeLessThan(0.55);
    expect(new Set(looks.map((look) => look.zoom)).size).toBe(13);
    expect(new Set(looks.map((look) => look.hue)).size).toBe(17);
    expect(povLook(42)).toEqual(povLook(42));
    // Sequential seeds vary too.
    expect(new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(povLook(i)))).size).toBeGreaterThan(15);
  });
});

describe("the hook clip chosen with the idea", () => {
  const ai = (id: string, type: AiHookClip["type"], tags: string[]): AiHookClip => ({ id, type, tags, climaxMs: 5000, durationMs: 8000, prompt: "p", costUsd: 0.56, madeOn: "2026-11-19" });
  const AI: AiHookClip[] = [ai("a1", "anticipation", ["domino"]), ai("a2", "anticipation", ["ball"]), ai("a3", "impossible", ["ink"])];
  const PIXABAY: HookLibraryClip[] = [
    { id: "p1", type: "anticipation", tags: ["domino"], climaxMs: 4000 },
    { id: "p2", type: "danger", tags: ["climb"], climaxMs: 4000 },
  ];

  it("is an AI clip for about 70% of ideas, a Pixabay one for the rest, as the make job decides", () => {
    const seeds = Array.from({ length: 4000 }, (_, i) => stableHash(`Idea title ${i}`));
    const picks = seeds.map((seed) => hookPick("anticipation", "domino chain", seed, new Set(), AI, PIXABAY)!);
    const share = picks.filter((pick) => pick.provider === "ai").length / picks.length;
    expect(share).toBeGreaterThan(0.67);
    expect(share).toBeLessThan(0.73);
    seeds.forEach((seed, i) => expect(picks[i].provider).toBe(opensOnAiClip(seed) ? "ai" : "pixabay"));
  });

  it("falls back to the other library when one has no clip of the type, and to none when neither has", () => {
    const aiSeed = Array.from({ length: 50 }, (_, i) => i).find((seed) => opensOnAiClip(seed))!;
    const pixabaySeed = Array.from({ length: 50 }, (_, i) => i).find((seed) => !opensOnAiClip(seed))!;
    expect(hookPick("danger", "climb", aiSeed, new Set(), AI, PIXABAY)).toEqual({ provider: "pixabay", id: "p2" });
    expect(hookPick("impossible", "ink", pixabaySeed, new Set(), AI, PIXABAY)).toEqual({ provider: "ai", id: "a3" });
    expect(hookPick("impossible", "ink", aiSeed, new Set(), [], [])).toBeNull();
  });

  it("skips clips already used in the batch, reusing one only when nothing else is left", () => {
    const aiSeed = Array.from({ length: 50 }, (_, i) => i).find((seed) => opensOnAiClip(seed))!;
    const used = new Set(["ai:a1", "ai:a2"]);
    expect(hookPick("anticipation", "domino", aiSeed, used, AI, PIXABAY)).toEqual({ provider: "pixabay", id: "p1" });
    used.add("pixabay:p1");
    expect(hookPick("anticipation", "domino", aiSeed, used, AI, PIXABAY)?.provider).toBe("ai");
  });
});

describe("the writer's instructions for POV clips", () => {
  const brief = (pov: boolean, slot = 1): SlotBrief => ({
    slot,
    category: "viral",
    direction: pov ? "meme" : "footage",
    alternatives: [],
    format: "reel",
    audio: pov ? "text_music" : "voiceover",
    techniques: ["curiosity_hooks"],
    length: pov ? POV_LENGTH : { seconds: { min: 30, max: 45 }, words: { min: 72, max: 108 }, points: { min: 3, max: 4 } },
    pov,
  });
  const input = (briefs: SlotBrief[], povClips: IdeaInput["povClips"]): IdeaInput => ({
    count: briefs.length,
    language: "English",
    profile: {},
    articles: [],
    avoidTitles: [],
    slots: briefs,
    strategy: { goal: "balanced", tonePreset: "professional", humor: "light", allowControversial: false, strongLanguage: false, trendInspired: true, priorityTopics: null, includeCta: true, defaultCta: null, narration: "natural" },
    learning: [],
    povClips,
  });
  const clips = POV_LIBRARY.map(({ id, shows }) => ({ id, shows }));

  it("list the clips and their rules only for a batch with a POV slot", () => {
    const prompt = systemPrompt(input([brief(true, 1), brief(false, 2)], clips));
    expect(prompt).toContain("POV CLIP VIDEO");
    for (const clip of POV_LIBRARY) expect(prompt).toContain(`- ${clip.id}: ${clip.shows}`);
    expect(prompt).toContain('"points": [] and "proof": ""');
    expect(prompt).toContain("never mention RepGet");
    expect(prompt).toContain("Slot 1: viral; POV CLIP slot");
    expect(prompt).not.toContain("Slot 2: viral; POV CLIP");
    expect(prompt).toContain("CORE RULES");

    const none = systemPrompt(input([brief(false, 1), brief(false, 2)], clips));
    expect(none).not.toContain("POV CLIP VIDEO");
    expect(none).not.toContain(POV_LIBRARY[0].id);
    expect(none).toContain('"povClip": null');
    // A POV slot with no clips to pick from gets no clip list either.
    expect(systemPrompt(input([brief(true)], []))).not.toContain("POV CLIP VIDEO (");
  });

  it("answer with a clip id or null for every idea", () => {
    const idea = { slot: 1, title: "t", article: null, direction: "meme", audio: "text_music", hook: "POV: x", points: [], proof: "", cta: "c", caption: "c", hashtags: [], why: null, techniques: [], visualHook: null, scenes: [], claims: [], controversial: false, sensitive: false };
    expect(ideaSchema.parse({ ideas: [{ ...idea, povClip: "2026-11-21-pov-cat-phone" }] }).ideas[0].povClip).toBe("2026-11-21-pov-cat-phone");
    expect(ideaSchema.parse({ ideas: [{ ...idea, povClip: null }] }).ideas[0].povClip).toBeNull();
  });
});
