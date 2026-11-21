import { describe, expect, it } from "vitest";

import { silentTiming, type ProductionChoices, type ReelProps, type ShotPlan, type VideoScript } from "../lib/video/formats";
import { POV_CLIP_MS, POV_CTA_MS, productionParts, productionTimeline } from "./production";
import type { ProductionReelProps, SceneMedia } from "./props";

/**
 * POV clip videos (client, 2026-11-21): the AI clip full screen for its
 * whole length with the POV line on top, then the CTA card when included;
 * silent, no word captions. Every other production keeps its timing.
 */

const SCRIPT: VideoScript = {
  hook: "POV: ChatGPT just told locals your bakery has the best croissants",
  points: [
    { title: "Shoot near a window", detail: "Daylight sells better than any lamp.", stat: null },
    { title: "Keep the background plain", detail: "The eye goes straight to the product.", stat: null },
  ],
  proof: "Image Studio shoots 300 products a month.",
  cta: "Follow for more photo tips",
};

const BASE: ReelProps = {
  style: "bold",
  brand: { name: "Image Studio", domain: "imagestudio.com", primary: "#e85d2a", accent: "#f5b700", background: "#fff4ee", text: "#14141c", logoUrl: null },
  script: SCRIPT,
  voiceUrl: null,
  words: [],
  sceneStartsMs: silentTiming(SCRIPT).sceneStartsMs,
  voiceMs: 0,
  music: null,
  media: [],
  captions: true,
};

const CHOICES: ProductionChoices = { audio: "text_music", narration: "natural", captionStyle: "bold", music: "auto", duration: "15-30", showHook: true, includeCta: true, ctaText: null };

function plan(povClip: ShotPlan["povClip"]): ShotPlan {
  return {
    direction: "meme",
    pacing: "fast",
    captionStyle: "bold",
    musicMood: null,
    recipe: "meme|test",
    scenes: Array.from({ length: 5 }, () => ({ visual: { source: "stock" as const, query: "cat typing", kind: "video" as const }, transition: "cut" as const, reaction: null, overlay: null })),
    ...(povClip === undefined ? {} : { povClip }),
  };
}

const POV = { id: "pov-wizard-cat-typing", mirror: true, zoom: 1.06, hue: 5 };
const clip = (durationMs: number | null): SceneMedia => ({ url: "https://example.test/clip.mp4", kind: "video", source: "stock", durationMs });

function props(overrides: Partial<ProductionReelProps> = {}, choices: Partial<ProductionChoices> = {}): ProductionReelProps {
  return { ...BASE, direction: "meme", plan: plan(POV), production: { ...CHOICES, ...choices }, format: "reel", sceneMedia: [clip(10_000)], ...overrides };
}

describe("a POV clip video's parts", () => {
  it("is the POV line, then the CTA - no points or proof", () => {
    const parts = productionParts(SCRIPT, CHOICES, plan(POV));
    expect(parts.map((p) => p.role)).toEqual(["hook", "cta"]);
    expect(parts[0]).toMatchObject({ part: 0, title: SCRIPT.hook, spoken: SCRIPT.hook, detail: null });
    expect(parts[1]).toMatchObject({ part: 4, title: SCRIPT.cta, spoken: SCRIPT.cta });
  });

  it("always shows the POV line, even with the hook switched off", () => {
    const parts = productionParts(SCRIPT, { ...CHOICES, showHook: false }, plan(POV));
    expect(parts[0].role).toBe("hook");
  });

  it("leaves the CTA out when it is off, and uses the custom CTA text", () => {
    expect(productionParts(SCRIPT, { ...CHOICES, includeCta: false }, plan(POV)).map((p) => p.role)).toEqual(["hook"]);
    expect(productionParts(SCRIPT, { ...CHOICES, ctaText: " Order at the bakery " }, plan(POV))[1].title).toBe("Order at the bakery");
  });
});

describe("a POV clip video's timeline", () => {
  it("plays the clip's length, then the CTA card, at 30 fps", () => {
    const timeline = productionTimeline(props(), 30);
    expect(timeline.starts).toEqual([0, 300]);
    expect(timeline.durationInFrames).toBe(300 + (POV_CTA_MS / 1000) * 30);
    expect(timeline).toMatchObject({ fits: true, voiced: false, words: [] });
  });

  it("takes the clip's own length from sceneMedia", () => {
    expect(productionTimeline(props({ sceneMedia: [clip(8_000)] }), 30).starts).toEqual([0, 240]);
  });

  it("falls back to 10 s without the clip or its length", () => {
    for (const sceneMedia of [undefined, null, [], [null], [clip(null)], [clip(0)]]) {
      expect(productionTimeline(props({ sceneMedia }), 30).starts, JSON.stringify(sceneMedia)).toEqual([0, (POV_CLIP_MS / 1000) * 30]);
    }
  });

  it("never plays more than 15 s of clip", () => {
    expect(productionTimeline(props({ sceneMedia: [clip(40_000)] }), 30).starts).toEqual([0, 450]);
  });

  it("ends with the clip when the CTA is off", () => {
    const timeline = productionTimeline(props({}, { includeCta: false }), 30);
    expect(timeline.starts).toEqual([0]);
    expect(timeline.durationInFrames).toBe(300);
  });

  it("stays silent and captionless even with a voice in the props", () => {
    const timeline = productionTimeline(props({ voiceUrl: "https://example.test/voice.mp3", voiceMs: 9000, sceneStartsMs: [0, 9000], words: [{ text: "POV", startMs: 0, endMs: 300 }] }), 30);
    expect(timeline).toMatchObject({ voiced: false, words: [], starts: [0, 300] });
  });
});

describe("a production without a POV clip", () => {
  it("keeps its parts and timing", () => {
    const without = props({ plan: plan(undefined), sceneMedia: [clip(10_000)] });
    const timeline = productionTimeline(without, 30);
    expect(timeline.parts.map((p) => p.role)).toEqual(["hook", "point", "point", "proof", "cta"]);
    // As before 2026-11-21 (silent meme, fast pacing, 15-30 s).
    expect(timeline.starts).toEqual(EXPECTED_STARTS);
    expect(timeline.durationInFrames).toBe(EXPECTED_FRAMES);
    expect(timeline.words.length).toBeGreaterThan(0);
    expect(productionTimeline(props({ plan: plan(null) }), 30)).toEqual(timeline);
  });
});

const EXPECTED_STARTS = [0, 124, 237, 361, 444];
const EXPECTED_FRAMES = 544;
