import { describe, expect, it } from "vitest";

import type { DirectionProps } from "@/remotion/directions/common";
import { hookRoom } from "@/remotion/directions/HookClip";
import { productionTimeline, hookTiming, HOOK_MIN_RATE } from "@/remotion/production";
import type { ProductionReelProps } from "@/remotion/props";

import { HOOK_TECHNIQUES, HOOK_TECHNIQUES_FROM, HOOK_TYPES, hookTypeOf, VIRAL_TECHNIQUES, type VideoScript } from "./formats";
import { AI_HOOK_LIBRARY, AI_PROVIDER, aiClipPath } from "./footage/ai-library";
import { AI_HOOK_SHARE, libraryPicks, opensOnAiClip } from "./footage/hooks";
import { HOOK_LIBRARY, type HookLibraryClip } from "./footage/hook-library";
import { buildPlan, stableHash } from "./strategy/creative";
import { canHook, hookQuery, hookTypeFor, SAFE_HOOK_QUERIES, savedTechniques, unsafeHookWords, withOneHook, withoutHooks } from "./strategy/hooks";
import { systemPrompt, type IdeaInput, type SlotBrief } from "./strategy/prompt";

/**
 * Visual hooks (client, 2026-11-18): anticipation, impossible and danger
 * clips that open a reel, run small in a corner and pay off behind the proof.
 */

const SCRIPT: VideoScript = {
  hook: "Booking a photographer without checking this?",
  points: [
    { title: "Session types differ", detail: "Portrait and editorial sessions follow different formats.", stat: null },
    { title: "Prices vary", detail: "Quotes can be per hour or per package.", stat: null },
    { title: "Delivery terms", detail: "Agree the turnaround before the day.", stat: null },
  ],
  proof: "Image Studio has shot across Italy for years.",
  cta: "Follow for more",
};

describe("which ideas get a visual hook", () => {
  it("adds three hook techniques to the viral list", () => {
    expect(HOOK_TECHNIQUES.every((technique) => (VIRAL_TECHNIQUES as readonly string[]).includes(technique))).toBe(true);
    expect(HOOK_TECHNIQUES.map(hookTypeOf)).toEqual(["anticipation", "impossible", "danger"]);
    expect(hookTypeOf("curiosity_hooks")).toBeNull();
  });

  it("only reels and Stories that are not the animated templates", () => {
    expect(canHook("reel", "footage")).toBe(true);
    expect(canHook("story", "text_music")).toBe(true);
    expect(canHook("carousel", "footage")).toBe(false);
    expect(canHook("reel", "animated")).toBe(false);
    expect(hookTypeFor(["myth_busting", "danger_hook"], "reel", "voiceover")).toBe("danger");
    expect(hookTypeFor(["danger_hook"], "carousel", "footage")).toBeNull();
    expect(hookTypeFor(["curiosity_hooks"], "reel", "footage")).toBeNull();
  });

  it("keeps one hook an idea, and a technique when the hooks go", () => {
    expect(withOneHook(["anticipation_hook", "danger_hook"])).toEqual(["anticipation_hook"]);
    expect(withOneHook(["myth_busting", "impossible_hook"])).toEqual(["myth_busting", "impossible_hook"]);
    expect(withoutHooks(["myth_busting", "danger_hook"])).toEqual(["myth_busting"]);
    expect(withoutHooks(["danger_hook"])).toEqual(["curiosity_hooks"]);
  });

  it("switches them on for settings saved before they existed, and keeps a later choice", () => {
    const before = new Date(HOOK_TECHNIQUES_FROM.getTime() - 1);
    expect(savedTechniques(["curiosity_hooks", "unknown"], before)).toEqual(["curiosity_hooks", ...HOOK_TECHNIQUES]);
    expect(savedTechniques(["curiosity_hooks", "danger_hook"], before)).toEqual(["curiosity_hooks", "danger_hook", "anticipation_hook", "impossible_hook"]);
    expect(savedTechniques(["curiosity_hooks"], HOOK_TECHNIQUES_FROM)).toEqual(["curiosity_hooks"]);
  });
});

describe("the opening clip's search words", () => {
  it("uses the writer's words when they are concrete and safe", () => {
    expect(hookQuery("anticipation", "Domino chain toppling, close-up!", 0)).toBe("domino chain toppling close-up");
  });

  it("never searches for harm, vehicles, animals or children - a safe one of the type instead", () => {
    for (const words of ["car crash slow motion", "kids jumping off roof", "dog on a cliff edge", "knife juggling"]) {
      expect(unsafeHookWords(words)).toBe(true);
      expect(SAFE_HOOK_QUERIES.danger).toContain(hookQuery("danger", words, 3));
    }
    expect(SAFE_HOOK_QUERIES.impossible).toContain(hookQuery("impossible", "", 1));
    expect(SAFE_HOOK_QUERIES.anticipation).toContain(hookQuery("anticipation", "wow", 1));
  });

  it("keeps every safe query safe", () => {
    for (const list of Object.values(SAFE_HOOK_QUERIES)) for (const query of list) expect(unsafeHookWords(query)).toBe(false);
  });
});

describe("the hook library", () => {
  const LIBRARY: HookLibraryClip[] = [
    { id: "1", type: "anticipation", tags: ["domino", "chain"], climaxMs: 5000 },
    { id: "2", type: "anticipation", tags: ["domino", "toppling"], climaxMs: 4000 },
    { id: "3", type: "anticipation", tags: ["basketball"], climaxMs: 3000 },
    { id: "4", type: "danger", tags: ["jenga"], climaxMs: 6000 },
  ];

  it("offers clips of the type, the matching ones first, taking turns", () => {
    const first = libraryPicks("anticipation", "domino chain falling", 0, new Set(), LIBRARY).map((clip) => clip.id);
    const next = libraryPicks("anticipation", "domino chain falling", 1, new Set(), LIBRARY).map((clip) => clip.id);
    expect(first).toEqual(["1", "2", "3"]);
    expect(next).toEqual(["2", "1", "3"]);
    expect(libraryPicks("danger", "anything", 5, new Set(), LIBRARY).map((clip) => clip.id)).toEqual(["4"]);
  });

  it("has hand-picked clips of every type, each with a climax that leaves room for the opening", () => {
    expect(new Set(HOOK_LIBRARY.map((clip) => clip.id)).size).toBe(HOOK_LIBRARY.length);
    for (const type of HOOK_TYPES) expect(HOOK_LIBRARY.filter((clip) => clip.type === type).length).toBeGreaterThanOrEqual(3);
    for (const clip of HOOK_LIBRARY) {
      expect(clip.id).toMatch(/^\d+$/);
      expect(clip.climaxMs).toBeGreaterThanOrEqual(2500);
      expect(clip.focalX ?? 0.5).toBeGreaterThanOrEqual(0);
      expect(clip.focalX ?? 0.5).toBeLessThanOrEqual(1);
      expect(unsafeHookWords(clip.tags.join(" "))).toBe(false);
    }
  });

  it("leaves out a clip the video already uses", () => {
    expect(libraryPicks("anticipation", "domino", 0, new Set(["pixabay:1"]), LIBRARY).map((clip) => clip.id)).toEqual(["2", "3"]);
    // Another provider's clip with the same id is a different file.
    expect(libraryPicks("anticipation", "domino", 0, new Set(["pixabay:1"]), LIBRARY, AI_PROVIDER).map((clip) => clip.id)).toEqual(["1", "2", "3"]);
    expect(libraryPicks("anticipation", "domino", 0, new Set([`${AI_PROVIDER}:1`]), LIBRARY, AI_PROVIDER).map((clip) => clip.id)).toEqual(["2", "3"]);
  });
});

describe("the AI hook clips", () => {
  it("are checked 9:16 clips with a climax that leaves room for the opening and a second of payoff", () => {
    expect(new Set(AI_HOOK_LIBRARY.map((clip) => clip.id)).size).toBe(AI_HOOK_LIBRARY.length);
    for (const clip of AI_HOOK_LIBRARY) {
      expect(clip.id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      expect(clip.id.startsWith(clip.madeOn)).toBe(true);
      expect(HOOK_TYPES).toContain(clip.type);
      expect(clip.climaxMs).toBeGreaterThanOrEqual(2500);
      expect(clip.climaxMs).toBeLessThanOrEqual(clip.durationMs - 1000);
      expect(clip.focalX).toBeUndefined();
      expect(clip.costUsd).toBeGreaterThan(0);
      expect(clip.prompt.length).toBeGreaterThan(40);
      expect(unsafeHookWords(clip.tags.join(" "))).toBe(false);
    }
  });

  it("open about 70% of hooked videos, Pixabay the rest, fixed per video", () => {
    expect(AI_HOOK_SHARE).toBe(0.7);
    const ids = Array.from({ length: 4000 }, (_, i) => `${(i * 2654435761).toString(16).padStart(8, "0")}-4b1d-4c2e-9f00-${String(i).padStart(12, "0")}`);
    const share = ids.filter((id) => opensOnAiClip(stableHash(id))).length / ids.length;
    expect(share).toBeGreaterThan(0.67);
    expect(share).toBeLessThan(0.73);
    // Sequential seeds too, and the same video always gets the same answer.
    const sequential = Array.from({ length: 4000 }, (_, i) => opensOnAiClip(i)).filter(Boolean).length / 4000;
    expect(sequential).toBeGreaterThan(0.67);
    expect(sequential).toBeLessThan(0.73);
    expect(opensOnAiClip(stableHash(ids[7]))).toBe(opensOnAiClip(stableHash(ids[7])));
    expect(opensOnAiClip(123, 0)).toBe(false);
    expect(opensOnAiClip(123, 1)).toBe(true);
  });

  it("live in the bucket's shared folder, which no website's cleanup touches", () => {
    expect(aiClipPath("2026-11-19-marble-run")).toBe("shared/ai-clips/2026-11-19-marble-run.mp4");
  });
});

describe("the plan of a hooked idea", () => {
  const input = { direction: "footage" as const, format: "reel" as const, script: SCRIPT, scenes: [], captionStyle: "bold" as const, music: "auto" as const, ownMedia: true, articlePicture: true, fallbackQuery: "photographer" };

  it("opens on a stock clip of the hook's words and records the hook", () => {
    const plan = buildPlan({ ...input, hook: { type: "danger", query: "jenga tower falling" } });
    expect(plan.hookClip).toEqual({ type: "danger" });
    expect(plan.scenes[0].visual).toEqual({ source: "stock", query: "jenga tower falling", kind: "video" });
    expect(plan.recipe).toMatch(/\|hook-danger$/);
  });

  it("is unchanged without one", () => {
    const plan = buildPlan(input);
    expect(plan.hookClip).toBeUndefined();
    expect(plan.recipe).not.toMatch(/hook-/);
  });
});

describe("the writer's instructions", () => {
  const slot = (techniques: SlotBrief["techniques"]): SlotBrief => ({
    slot: 1,
    category: "viral",
    direction: "footage",
    alternatives: [],
    format: "reel",
    audio: "voiceover",
    techniques,
    length: { seconds: { min: 30, max: 45 }, words: { min: 72, max: 108 }, points: { min: 3, max: 4 } },
  });
  const input = (techniques: SlotBrief["techniques"]): IdeaInput => ({
    count: 1,
    language: "English",
    profile: {},
    articles: [],
    avoidTitles: [],
    slots: [slot(techniques)],
    strategy: { goal: "balanced", tonePreset: "professional", humor: "light", allowControversial: false, strongLanguage: false, trendInspired: true, priorityTopics: null, includeCta: true, defaultCta: null, narration: "natural" },
    learning: [],
  });

  it("explain the visual hook only to a batch that has one, with its safety rules", () => {
    const hooked = systemPrompt(input(["anticipation_hook"]));
    expect(hooked).toContain("VISUAL HOOK");
    expect(hooked).toContain("Never real injury");
    expect(systemPrompt(input(["curiosity_hooks"]))).not.toContain("VISUAL HOOK (");
  });
});

describe("the hook clip's timing", () => {
  const props = {
    script: SCRIPT,
    voiceUrl: "https://repget.example/voice.mp3",
    voiceMs: 30_000,
    words: [],
    // hook 0-3 s, points 3-21 s, proof 21-26 s, CTA 26-30 s.
    sceneStartsMs: [0, 3000, 9000, 15000, 21000, 26000],
    production: { audio: "voiceover", narration: "natural", captionStyle: "bold", music: "auto", duration: "30-45", showHook: true, includeCta: true, ctaText: null },
  } as unknown as ProductionReelProps;
  const timeline = productionTimeline(props, 30);

  it("opens full screen, slows the corner clip to reach the run-up at the proof, and pays off from just before the climax", () => {
    const timing = hookTiming(timeline, { durationMs: 12_000, climaxMs: 8000 }, 30)!;
    expect(timing.open).toMatchObject({ from: 0, frames: 90, clipFrom: 0, rate: 1, playFrames: 90 });
    // 7 s of clip (frames 90-210) are left before the run-up at 7 s (210); the points last 18 s.
    expect(timing.inset).toMatchObject({ from: 90, frames: 540, clipFrom: 90 });
    expect(timing.inset!.rate).toBeCloseTo(Math.max(HOOK_MIN_RATE, 120 / 540));
    expect(timing.inset!.playFrames).toBeLessThanOrEqual(540);
    // The clip's last frame is 359: 149 of the proof's 150 frames play, the last one held.
    expect(timing.payoff).toMatchObject({ from: 630, frames: 150, clipFrom: 210, rate: 1, playFrames: 149 });
  });

  it("guesses the climax at 60% of a clip without one, and holds a short clip's last frame", () => {
    const timing = hookTiming(timeline, { durationMs: 6000 }, 30)!;
    // 179 frames: climax at 107, run-up from 77.
    expect(timing.payoff!.clipFrom).toBe(77);
    expect(timing.payoff!.playFrames).toBe(179 - 77);
    // The 3 s opening would pass the run-up: slowed, never below half speed, then held.
    expect(timing.open.rate).toBeGreaterThanOrEqual(0.5);
    expect(Math.round(timing.open.playFrames * timing.open.rate)).toBeLessThanOrEqual(77);
  });

  it("keeps the points' text clear of the corner box, and only while it shows", () => {
    const direction = { ...props, timeline, plan: { hookClip: { type: "danger" } }, sceneMedia: [{ url: "https://repget.example/clip.mp4", kind: "video", durationMs: 12_000, climaxMs: 8000 }] } as unknown as DirectionProps;
    const [hook, point] = timeline.parts;
    const proof = timeline.parts.find((part) => part.role === "proof")!;
    expect(hookRoom(direction, point, 30)).toBeGreaterThan(0);
    expect(hookRoom(direction, hook, 30)).toBe(0);
    expect(hookRoom(direction, proof, 30)).toBe(0);
    // No box: a picture, a clip of unknown length, or no hook.
    expect(hookRoom({ ...direction, sceneMedia: [{ url: "https://repget.example/a.jpg", kind: "image" }] } as DirectionProps, point, 30)).toBe(0);
    expect(hookRoom({ ...direction, sceneMedia: [{ url: "https://repget.example/clip.mp4", kind: "video", durationMs: null }] } as DirectionProps, point, 30)).toBe(0);
    expect(hookRoom({ ...direction, plan: undefined } as DirectionProps, point, 30)).toBe(0);
  });

  it("only opens when the clip's length is unknown, and needs the hook on screen", () => {
    expect(hookTiming(timeline, { durationMs: null }, 30)).toMatchObject({ inset: null, payoff: null });
    const noHook = productionTimeline({ ...props, sceneStartsMs: [0, 6000, 12000, 18000, 24000], spokenParts: [1, 2, 3, 4, 5], production: { ...props.production!, showHook: false } }, 30);
    expect(hookTiming(noHook, { durationMs: 12_000 }, 30)).toBeNull();
  });
});
