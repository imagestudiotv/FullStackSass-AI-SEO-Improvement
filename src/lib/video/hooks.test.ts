import { describe, expect, it } from "vitest";

import { productionTimeline, hookTiming, HOOK_MIN_RATE } from "@/remotion/production";
import type { ProductionReelProps } from "@/remotion/props";

import { HOOK_TECHNIQUES, HOOK_TECHNIQUES_FROM, hookTypeOf, VIRAL_TECHNIQUES, type VideoScript } from "./formats";
import { libraryPicks } from "./footage/hooks";
import type { HookLibraryClip } from "./footage/hook-library";
import { buildPlan } from "./strategy/creative";
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

  it("leaves out a clip the video already uses", () => {
    expect(libraryPicks("anticipation", "domino", 0, new Set(["pixabay:1"]), LIBRARY).map((clip) => clip.id)).toEqual(["2", "3"]);
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

  it("only opens when the clip's length is unknown, and needs the hook on screen", () => {
    expect(hookTiming(timeline, { durationMs: null }, 30)).toMatchObject({ inset: null, payoff: null });
    const noHook = productionTimeline({ ...props, sceneStartsMs: [0, 6000, 12000, 18000, 24000], spokenParts: [1, 2, 3, 4, 5], production: { ...props.production!, showHook: false } }, 30);
    expect(hookTiming(noHook, { durationMs: 12_000 }, 30)).toBeNull();
  });
});
