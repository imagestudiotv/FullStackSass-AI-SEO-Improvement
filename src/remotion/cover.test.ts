import { describe, expect, it } from "vitest";

import { CREATIVE_DIRECTIONS, silentTiming, type CreativeDirection, type ReelProps, type ShotPlan, type Transition, type VideoScript } from "../lib/video/formats";
import { COVER_FALLBACK_SECONDS, coverFrame, coverSeconds } from "./cover";
import { ENTER_FRAMES, partEnd, productionTimeline } from "./production";
import type { ProductionReelProps } from "./props";
import { reelTiming, sceneEnd } from "./timing";

/**
 * The cover is the opening fully drawn (client, 2026-11-18: covers showed a
 * fading first frame with a lone caption letter): for every direction a
 * frame after its entrance, inside its first scene, before it leaves.
 */

const SCRIPT: VideoScript = {
  hook: "3 photo mistakes that cost you sales every single week",
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

function production(direction: CreativeDirection, transition: Transition = "cut", showHook = true): ProductionReelProps {
  const plan: ShotPlan = {
    direction,
    pacing: "medium",
    captionStyle: "bold",
    musicMood: null,
    recipe: `${direction}|test`,
    scenes: Array.from({ length: 5 }, () => ({ visual: { source: "stock" as const, query: "product photo", kind: "image" as const }, transition, reaction: "😳", overlay: null })),
  };
  return {
    ...BASE,
    direction,
    plan,
    production: { audio: "text_music", narration: "natural", captionStyle: "bold", music: "auto", duration: "30-45", showHook, includeCta: true, ctaText: null },
    format: "reel",
  };
}

const PRODUCTIONS = CREATIVE_DIRECTIONS.filter((direction) => direction !== "animated");

describe("a reel's cover frame", () => {
  it("waits for each direction's opening to land, and stays inside its first scene", () => {
    for (const direction of PRODUCTIONS) {
      for (const transition of ["cut", "fade", "zoom"] as Transition[]) {
        const props = production(direction, transition);
        const timeline = productionTimeline(props);
        const frame = coverFrame(props);
        // Past the entrance (the springs need about a second) and the transition in.
        expect(frame, `${direction} ${transition}`).toBeGreaterThanOrEqual(Math.max(29, ENTER_FRAMES[transition]));
        expect(frame, `${direction} ${transition}`).toBeLessThan(partEnd(timeline, 0) - 9);
      }
    }
  });

  it("comes before a meme's comic beat freezes the picture", () => {
    const props = production("meme");
    const timeline = productionTimeline(props);
    expect(coverFrame(props)).toBeLessThan(Math.round(partEnd(timeline, 0) * 0.42));
  });

  it("shows the first scene's title when the hook is switched off", () => {
    for (const direction of PRODUCTIONS) {
      const props = production(direction, "cut", false);
      const timeline = productionTimeline(props);
      expect(timeline.parts[0].role).toBe("point");
      const frame = coverFrame(props);
      expect(frame).toBeGreaterThan(20);
      expect(frame).toBeLessThan(partEnd(timeline, 0));
    }
  });

  it("waits longer for a long hook typed word by word", () => {
    const short = production("text_music");
    const long = { ...short, script: { ...SCRIPT, hook: "Five tiny product photo mistakes that quietly cost small shops their sales every single week of the year" } };
    expect(coverFrame(long)).toBeGreaterThan(coverFrame(short));
  });

  it("lands each original template's hook (Bold, Numbers, Story) after its animations", () => {
    for (const style of ["bold", "numbers", "story"] as const) {
      const props = { ...BASE, style };
      const timing = reelTiming(props);
      const frame = coverFrame(props);
      expect(frame, style).toBeGreaterThanOrEqual(style === "story" ? 30 : 44);
      expect(frame, style).toBeLessThan(sceneEnd(timing, 0) - 9);
    }
  });

  it("follows the voice: a hook spoken in a second keeps its cover inside that second", () => {
    // A voiced animated reel whose hook lasts 1.6 s (48 frames): the cover stays clear of its exit.
    const voiced: ReelProps = { ...BASE, voiceUrl: "https://files.example/voice.wav", voiceMs: 9000, sceneStartsMs: [0, 1600, 3600, 5600, 7400] };
    const frame = coverFrame(voiced);
    expect(frame).toBeLessThanOrEqual(48 - 10);
    expect(frame).toBeGreaterThan(0);
  });

  it("is given in seconds for the browser (#t=), about a second or two in", () => {
    const seconds = coverSeconds(BASE);
    expect(seconds).toBeCloseTo(coverFrame(BASE) / 30, 2);
    expect(seconds).toBeGreaterThan(1);
    expect(seconds).toBeLessThan(3);
    expect(COVER_FALLBACK_SECONDS).toBeGreaterThan(0.5);
  });
});
