import { describe, expect, it } from "vitest";

import type { IdeaCategory, ShotPlan, VideoFormat } from "../formats";
import type { AiHookClip, AiPovClip } from "../footage/ai-library";
import type { HookLibraryClip } from "../footage/hook-library";
import { clipStanding, NO_SITE_CLIPS, opensOnAiClip, siteClipOrder, type ClipUse, type SiteClips } from "../footage/hooks";
import { stableHash } from "./creative";
import { hookPick, movesOffMadeClips, pickPovClip, POV_LENGTH, POV_OFFER_SPARE, povClipsOffered, povLook, povScript, povSlots, type PendingClipIdea } from "./pov";
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
    expect(pickPovClip("2026-11-21-pov-dog-sofa", "POV: anything", new Set(), POV_LIBRARY)).toBe("2026-11-21-pov-dog-sofa");
  });

  // Replaced on 2026-11-26: the fallback was the best word match (equals rotated by the seed); it is now the website's clip order.
  it("else the next free clip in the website's order", () => {
    const line = "POV: ChatGPT just told locals your bakery has the best croissants";
    expect(pickPovClip("made-up-id", line, new Set(), POV_LIBRARY)).toBe("2026-11-21-pov-cat-phone");
    expect(pickPovClip(null, line, new Set(), POV_LIBRARY)).toBe("2026-11-21-pov-cat-phone");
    // Taken already in this batch: the writer's choice makes way.
    expect(pickPovClip("2026-11-21-pov-owl-croissant", line, new Set(["2026-11-21-pov-owl-croissant"]), POV_LIBRARY)).toBe("2026-11-21-pov-cat-phone");
    expect(pickPovClip(null, line, new Set(["2026-11-21-pov-cat-phone"]), POV_LIBRARY)).toBe("2026-11-21-pov-dog-sofa");
  });

  it("never repeats in a batch while a free one is left, and takes the library's order", () => {
    const used = new Set<string>();
    const order: string[] = [];
    for (let i = 0; i < POV_LIBRARY.length; i++) {
      const id = pickPovClip("2026-11-21-pov-cat-phone", "POV: nothing in common", used, POV_LIBRARY)!;
      expect(used.has(id)).toBe(false);
      used.add(id);
      order.push(id);
    }
    expect(order).toEqual(POV_LIBRARY.map((clip) => clip.id));
    // All used: still a clip.
    expect(POV_LIBRARY.map((clip) => clip.id)).toContain(pickPovClip(null, "POV: x", used, POV_LIBRARY));
  });

  it("is none on an empty library", () => {
    expect(pickPovClip("2026-11-21-pov-cat-phone", "POV: x", new Set(), [])).toBeNull();
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

/**
 * A website's clip order (client, 2026-11-26: "We don't want same client to
 * having same clips. We need to set a logic that every new client is
 * following a clip order from clip a to clip y").
 */
describe("a website's clip order", () => {
  const ids = POV_LIBRARY.map((clip) => clip.id);
  const shown = (at: number): ClipUse => ({ lastUsedAt: at, made: false });
  const made = (at: number): ClipUse => ({ lastUsedAt: at, made: true });

  /** Batches of `perBatch` POV ideas, one after the other, each seeing what the earlier ones used. */
  function batches(count: number, perBatch: number, library = POV_LIBRARY) {
    const use = new Map<string, ClipUse>();
    const out: string[][] = [];
    for (let b = 0; b < count; b++) {
      const batch = new Set<string>();
      for (let i = 0; i < perBatch; i++) batch.add(pickPovClip(null, "POV: nothing in common", batch, library, use)!);
      for (const id of batch) use.set(id, shown(b + 1));
      out.push([...batch]);
    }
    return out;
  }

  it("gives a new website clip 1, then 2, and so on, across batches", () => {
    expect(batches(2, 2)).toEqual([ids.slice(0, 2), ids.slice(2, 4)]);
    expect(batches(4, 1).flat()).toEqual(ids);
  });

  it("never repeats a clip the website used while one it never used is left, even when the writer asks for it", () => {
    const use = new Map([
      [ids[0], made(5)],
      [ids[1], shown(6)],
    ]);
    expect(pickPovClip(ids[0], "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[2]);
    expect(pickPovClip(ids[1], "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[2]);
    // The writer may still choose among the clips the website never used.
    expect(pickPovClip(ids[3], "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[3]);
    // A clip it was passed over for stays first in the order.
    use.set(ids[3], shown(7));
    expect(pickPovClip(null, "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[2]);
  });

  it("once every clip was used: the least recently used, the ones only shown in an idea before the ones made into a video", () => {
    const use = new Map([
      [ids[0], made(1)],
      [ids[1], shown(4)],
      [ids[2], shown(3)],
      [ids[3], made(2)],
    ]);
    expect(siteClipOrder(POV_LIBRARY, (clip) => clip.id, use).map((clip) => clip.id)).toEqual([ids[2], ids[1], ids[0], ids[3]]);
    expect(pickPovClip(null, "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[2]);
    // The writer's choice holds when it is as far along as the next one, not when it was made already.
    expect(pickPovClip(ids[1], "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[1]);
    expect(pickPovClip(ids[0], "POV: x", new Set(), POV_LIBRARY, use)).toBe(ids[2]);
    // Clips used at the same moment: the one that fits the line.
    const sameTime = new Map(ids.map((id) => [id, shown(9)]));
    expect(pickPovClip(null, "POV: the croissant everyone wants", new Set(), POV_LIBRARY, sameTime)).toBe("2026-11-21-pov-owl-croissant");
    // Eight batches of two on a four-clip library: every clip comes round in turn.
    const all = batches(8, 2).flat();
    for (const id of ids) expect(all.filter((entry) => entry === id)).toHaveLength(4);
  });

  it("never gives one clip twice in a batch while another is left", () => {
    const use = new Map(ids.map((id, i) => [id, made(i)]));
    const batch = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      const id = pickPovClip(null, "POV: x", batch, POV_LIBRARY, use)!;
      expect(batch.has(id)).toBe(false);
      batch.add(id);
    }
    expect([...batch]).toEqual(ids);
  });

  it("keeps clips appended to the library for after the ones before them", () => {
    const grown = [...POV_LIBRARY, pov("2026-11-27-pov-new", "A new clip.", ["new"])];
    const use = new Map(ids.map((id, i) => [id, shown(i + 1)]));
    expect(pickPovClip(null, "POV: x", new Set(), grown, use)).toBe("2026-11-27-pov-new");
    expect(pickPovClip(null, "POV: x", new Set(), grown, new Map())).toBe(ids[0]);
  });

  it("offers the writer the website's next clips: one per POV slot and a few spare, none without a POV slot", () => {
    const library = Array.from({ length: 12 }, (_, i) => pov(`clip-${String(i).padStart(2, "0")}`, `Clip ${i}.`, []));
    expect(povClipsOffered(2, library).map((clip) => clip.id)).toEqual(library.slice(0, 2 + POV_OFFER_SPARE).map((clip) => clip.id));
    const use = new Map([
      [library[0].id, made(1)],
      [library[2].id, shown(2)],
    ]);
    expect(povClipsOffered(1, library, use).map((clip) => clip.id)).toEqual(["clip-01", "clip-03", "clip-04", "clip-05"]);
    expect(povClipsOffered(1, library, use)[0]).toEqual({ id: "clip-01", shows: "Clip 1." });
    expect(povClipsOffered(0, library)).toEqual([]);
    expect(povClipsOffered(20, library)).toHaveLength(12);
  });

  it("ranks a clip: never used, only shown in an idea, made into a video", () => {
    expect(clipStanding(undefined)).toBe(0);
    expect(clipStanding(shown(1))).toBe(1);
    expect(clipStanding(made(1))).toBe(2);
  });
});

describe("a website's hook clip order", () => {
  const ai = (id: string, type: AiHookClip["type"], tags: string[]): AiHookClip => ({ id, type, tags, climaxMs: 5000, durationMs: 8000, prompt: "p", costUsd: 0.56, madeOn: "2026-11-19" });
  const AI: AiHookClip[] = [ai("a1", "anticipation", ["domino"]), ai("a2", "anticipation", ["ball"]), ai("a3", "anticipation", ["ink"]), ai("a4", "impossible", ["ink"])];
  const PIXABAY: HookLibraryClip[] = [
    { id: "p1", type: "anticipation", tags: ["domino"], climaxMs: 4000 },
    { id: "p2", type: "anticipation", tags: ["ball"], climaxMs: 4000 },
    { id: "p3", type: "danger", tags: ["climb"], climaxMs: 4000 },
  ];
  const aiSeed = Array.from({ length: 50 }, (_, i) => i).find((seed) => opensOnAiClip(seed))!;
  const pixabaySeed = Array.from({ length: 50 }, (_, i) => i).find((seed) => !opensOnAiClip(seed))!;
  const shown = (at: number): ClipUse => ({ lastUsedAt: at, made: false });
  const made = (at: number): ClipUse => ({ lastUsedAt: at, made: true });

  it("takes each library in its order, not by the search words, for a new website", () => {
    expect(hookPick("anticipation", "ball bouncing", aiSeed, new Set(), AI, PIXABAY)).toEqual({ provider: "ai", id: "a1" });
    expect(hookPick("anticipation", "ball bouncing", pixabaySeed, new Set(), AI, PIXABAY)).toEqual({ provider: "pixabay", id: "p1" });
    expect(hookPick("anticipation", "x", aiSeed, new Set(["ai:a1"]), AI, PIXABAY)).toEqual({ provider: "ai", id: "a2" });
  });

  it("skips the clips the website used, turning to the other library before repeating one", () => {
    const site = new Map([
      ["ai:a1", made(1)],
      ["ai:a2", shown(2)],
    ]);
    expect(hookPick("anticipation", "x", aiSeed, new Set(), AI, PIXABAY, site)).toEqual({ provider: "ai", id: "a3" });
    site.set("ai:a3", shown(3));
    expect(hookPick("anticipation", "x", aiSeed, new Set(), AI, PIXABAY, site)).toEqual({ provider: "pixabay", id: "p1" });
    site.set("pixabay:p1", made(4));
    site.set("pixabay:p2", shown(5));
    // All used: the least recently used of the ones only shown, then the made ones.
    expect(hookPick("anticipation", "x", aiSeed, new Set(), AI, PIXABAY, site)).toEqual({ provider: "ai", id: "a2" });
    expect(hookPick("anticipation", "x", aiSeed, new Set(["ai:a2", "ai:a3", "pixabay:p2"]), AI, PIXABAY, site)).toEqual({ provider: "ai", id: "a1" });
  });

  it("keeps the AI:Pixabay share while both libraries have clips the website never used", () => {
    const site = new Map([
      ["ai:a1", made(1)],
      ["pixabay:p1", made(1)],
    ]);
    const seeds = Array.from({ length: 2000 }, (_, i) => stableHash(`Idea title ${i}`));
    const picks = seeds.map((seed) => hookPick("anticipation", "domino", seed, new Set(), AI, PIXABAY, site)!);
    seeds.forEach((seed, i) => expect(picks[i]).toEqual(opensOnAiClip(seed) ? { provider: "ai", id: "a2" } : { provider: "pixabay", id: "p2" }));
    const share = picks.filter((pick) => pick.provider === "ai").length / picks.length;
    expect(share).toBeGreaterThan(0.66);
    expect(share).toBeLessThan(0.74);
  });
});

describe("clips moved off already-made ones", () => {
  const ids = POV_LIBRARY.map((clip) => clip.id);
  const plan = (extra: Partial<ShotPlan>): ShotPlan => ({ direction: "meme", pacing: "fast", captionStyle: "bold", musicMood: null, recipe: "r", scenes: [], ...extra }) as ShotPlan;
  const povIdea = (id: string, clip: string): PendingClipIdea => ({
    id,
    line: "POV: x",
    seed: 1,
    plan: plan({
      povClip: { id: clip, mirror: false, zoom: 1, hue: 0 },
      scenes: [{ visual: { source: "stock", query: POV_LIBRARY.find((entry) => entry.id === clip)!.shows, kind: "video" }, transition: "cut", reaction: null, overlay: "POV: x" }] as ShotPlan["scenes"],
    }),
  });
  const site = (pov: [string, ClipUse][], hooks: [string, ClipUse][] = []): SiteClips => ({ pov: new Map(pov), hooks: new Map(hooks) });

  it("give a waiting idea whose clip the website made a video with the next clip in its order, its scene with it", () => {
    const pending = [povIdea("idea-1", ids[0]), povIdea("idea-2", ids[1])];
    const use = site([
      [ids[0], { lastUsedAt: 1, made: true }],
      [ids[1], { lastUsedAt: 1, made: false }],
    ]);
    const moves = movesOffMadeClips(pending, use, 10, { pov: POV_LIBRARY });
    expect(moves).toHaveLength(1);
    expect(moves[0].id).toBe("idea-1");
    expect(moves[0].from).toEqual({ provider: "ai", id: ids[0] });
    expect(moves[0].plan.povClip).toEqual({ id: ids[2], mirror: false, zoom: 1, hue: 0 });
    expect(moves[0].plan.scenes[0].visual.query).toBe(POV_LIBRARY[2].shows);
    expect(moves[0].plan.scenes[0].overlay).toBe("POV: x");
  });

  it("never give two waiting ideas the same new clip, nor one another waiting idea holds", () => {
    const pending = [povIdea("idea-1", ids[0]), povIdea("idea-2", ids[0]), povIdea("idea-3", ids[2])];
    const use = site([
      [ids[0], { lastUsedAt: 1, made: true }],
      [ids[2], { lastUsedAt: 2, made: false }],
    ]);
    const moves = movesOffMadeClips(pending, use, 10, { pov: POV_LIBRARY });
    expect(moves.map((move) => [move.id, move.plan.povClip!.id])).toEqual([
      ["idea-1", ids[1]],
      ["idea-2", ids[3]],
    ]);
  });

  it("leave an idea as it is when every other clip was made already, and ideas without a made clip", () => {
    const all = site(ids.map((id) => [id, { lastUsedAt: 1, made: true }]));
    expect(movesOffMadeClips([povIdea("idea-1", ids[0])], all, 10, { pov: POV_LIBRARY })).toEqual([]);
    expect(movesOffMadeClips([povIdea("idea-1", ids[0])], NO_SITE_CLIPS, 10, { pov: POV_LIBRARY })).toEqual([]);
  });

  it("move a hook clip within its type, keeping the idea's AI or Pixabay side", () => {
    const ai = (id: string): AiHookClip => ({ id, type: "anticipation", tags: [], climaxMs: 5000, durationMs: 8000, prompt: "p", costUsd: 0.56, madeOn: "2026-11-19" });
    const PIXABAY: HookLibraryClip[] = [{ id: "p1", type: "anticipation", tags: [], climaxMs: 4000 }];
    const aiSeed = Array.from({ length: 50 }, (_, i) => i).find((seed) => opensOnAiClip(seed))!;
    const idea: PendingClipIdea = { id: "idea-1", line: "x", seed: aiSeed, plan: plan({ hookClip: { type: "anticipation", pick: { provider: "ai", id: "a1" } } }) };
    const libraries = { ai: [ai("a1"), ai("a2")], pixabay: PIXABAY };
    const moves = movesOffMadeClips([idea], site([], [["ai:a1", { lastUsedAt: 1, made: true }]]), 10, libraries);
    expect(moves).toEqual([{ id: "idea-1", plan: { ...idea.plan, hookClip: { type: "anticipation", pick: { provider: "ai", id: "a2" } } }, from: { provider: "ai", id: "a1" } }]);
    // Only shown in another idea, never made: it stays.
    expect(movesOffMadeClips([idea], site([], [["ai:a1", { lastUsedAt: 1, made: false }]]), 10, libraries)).toEqual([]);
  });
});
