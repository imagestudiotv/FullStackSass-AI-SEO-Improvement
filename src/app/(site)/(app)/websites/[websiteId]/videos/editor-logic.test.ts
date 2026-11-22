import { describe, expect, it } from "vitest";

import type { ProductionChoices, ShotPlan, VideoScript } from "@/lib/video/formats";
import { DEFAULT_PRODUCTION, productionTimeline } from "@/remotion/production";
import type { ProductionReelProps } from "@/remotion/props";
import { reelTiming } from "@/remotion/timing";

import {
  audioLock,
  canEditIdea,
  captionsApply,
  ctaSwitchApplies,
  editFromForm,
  editorProblems,
  formFromIdea,
  hookSwitchApplies,
  isDirty,
  maxPoints,
  musicChoice,
  partFrame,
  partSlide,
  previewProps,
  textStyles,
  visibleParts,
  voiceChoice,
  withMusicChoice,
  withTextStyle,
  withVoiceChoice,
  type EditorForm,
  type EditorIdea,
} from "./editor-logic";

const SCRIPT: VideoScript = {
  hook: "Your site is invisible",
  points: [
    { title: "Fix your titles", detail: "Search engines read them first.", stat: null },
    { title: "Answer real questions", detail: "People search in questions.", stat: { value: 40, suffix: "%", label: "more clicks" } },
    { title: "Link your pages", detail: "Each page helps the next.", stat: null },
  ],
  proof: "Our customers doubled their visits.",
  cta: "Start today",
};

const production = (change: Partial<ProductionChoices> = {}): ProductionChoices => ({ ...DEFAULT_PRODUCTION, ...change });

const idea = (change: Partial<EditorIdea> = {}): EditorIdea => ({
  title: "Be found on Google",
  caption: "Three quick fixes. #seo",
  style: "bold",
  format: "reel",
  voice: "nova",
  musicTrack: null,
  captions: true,
  category: "educational",
  direction: "animated",
  production: production(),
  overrides: {},
  props: { script: SCRIPT },
  ...change,
});

const PLAN: ShotPlan = {
  direction: "footage",
  pacing: "medium",
  captionStyle: "bold",
  musicMood: null,
  scenes: Array.from({ length: 6 }, () => ({ visual: { source: "stock" as const, query: "office", kind: "video" as const }, transition: "cut" as const, reaction: null, overlay: null })),
  recipe: "test",
};

const BASE: ProductionReelProps = {
  style: "bold",
  brand: { name: "Acme", domain: "acme.test", primary: "#ff6600", accent: "#222222", background: "#ffffff", text: "#111111", logoUrl: null },
  script: SCRIPT,
  voiceUrl: "https://cdn.test/voice.mp3",
  words: [{ text: "Your", startMs: 0, endMs: 200 }],
  sceneStartsMs: [0, 1000, 2000, 3000, 4000, 5000],
  voiceMs: 6000,
  music: null,
  media: [],
  captions: true,
  direction: "footage",
  plan: PLAN,
  production: production(),
  format: "reel",
  concept: false,
};

describe("the editor's form", () => {
  it("opens with the idea's fields and saves the same edit the old dialog did", () => {
    const form = formFromIdea(idea(), "coral");
    expect(form.voice).toBe("nova");
    expect(editFromForm(form)).toEqual({
      title: "Be found on Google",
      script: SCRIPT,
      caption: "Three quick fixes. #seo",
      style: "bold",
      format: "reel",
      category: "educational",
      direction: "animated",
      production: { ...production(), ctaText: null },
      overrides: {},
      voice: "nova",
      musicTrack: null,
      captions: true,
    });
  });

  it("reads an idea saved without music as No music, and keeps it that way", () => {
    const form = formFromIdea(idea({ musicTrack: "none" }), "coral");
    expect(form.production.music).toBe("none");
    expect(musicChoice(form)).toBe("mood:none");
    expect(editFromForm(form).musicTrack).toBe("none");
  });

  it("falls back to the website's voice when the idea has none", () => {
    expect(formFromIdea(idea({ voice: null }), "ash").voice).toBe("ash");
  });

  it("trims the title and the call to action, and drops empty overrides", () => {
    const form: EditorForm = {
      ...formFromIdea(idea(), "coral"),
      title: "  Spaced  ",
      production: production({ ctaText: "   " }),
      overrides: { audience: "  ", tone: "friendly" },
    };
    const edit = editFromForm(form);
    expect(edit.title).toBe("Spaced");
    expect(edit.production?.ctaText).toBeNull();
    expect(edit.overrides).toEqual({ tone: "friendly" });
  });

  it("is dirty only after a real change", () => {
    const initial = formFromIdea(idea(), "coral");
    expect(isDirty(initial, { ...initial })).toBe(false);
    expect(isDirty(initial, { ...initial, script: { ...initial.script, hook: "New hook" } })).toBe(true);
    // An empty override is the same as none.
    expect(isDirty(initial, { ...initial, overrides: { tone: "" } })).toBe(false);
  });

  it("says what the server would refuse before saving", () => {
    const form = formFromIdea(idea(), "coral");
    expect(editorProblems(form)).toEqual([]);
    const empty: EditorForm = { ...form, title: " ", caption: "", script: { ...form.script, hook: "", points: [{ ...SCRIPT.points[0], title: "" }, SCRIPT.points[1]] } };
    expect(editorProblems(empty)).toEqual(["title", "hook", "point", "caption"]);
  });

  it("lets only new and failed ideas be edited", () => {
    expect(canEditIdea("new")).toBe(true);
    expect(canEditIdea("failed")).toBe(true);
    for (const status of ["approved", "making", "ready", "scheduled", "posted", "skipped"]) expect(canEditIdea(status)).toBe(false);
  });
});

describe("the simple controls and the fields they stand for", () => {
  it("Voiceover: off is Text + music, a voice is a voiceover with that narrator", () => {
    const form = formFromIdea(idea({ direction: "footage" }), "coral");
    const off = withVoiceChoice(form, "off");
    expect(voiceChoice(off)).toBe("off");
    expect(editFromForm(off)).toMatchObject({ voice: null, production: { audio: "text_music" } });
    const on = withVoiceChoice(off, "onyx");
    expect(voiceChoice(on)).toBe("onyx");
    expect(editFromForm(on)).toMatchObject({ voice: "onyx", production: { audio: "voiceover" } });
  });

  it("Voiceover follows what the look and format force, as the server does", () => {
    expect(audioLock("text_music", "reel")).toBe("text_music");
    expect(audioLock("footage", "carousel")).toBe("text_music");
    expect(audioLock("voiceover", "reel")).toBe("voiceover");
    expect(audioLock("meme", "story")).toBeNull();
    const voiced = withVoiceChoice(formFromIdea(idea({ direction: "voiceover" }), "coral"), "off");
    expect(voiceChoice(voiced)).toBe("nova");
    expect(editFromForm(voiced)).toMatchObject({ voice: "nova", production: { audio: "voiceover" } });
    const carousel = { ...formFromIdea(idea(), "coral"), format: "carousel" };
    expect(voiceChoice(carousel)).toBe("off");
    expect(editFromForm(carousel)).toMatchObject({ voice: null, production: { audio: "text_music" } });
  });

  it("Music: one dropdown for the mood and the library track", () => {
    const form = formFromIdea(idea(), "coral");
    expect(musicChoice(form)).toBe("mood:auto");
    const track = withMusicChoice({ ...form, production: production({ music: "none" }) }, "track:t1");
    expect(musicChoice(track)).toBe("track:t1");
    expect(editFromForm(track)).toMatchObject({ musicTrack: "t1", production: { music: "auto" } });
    const upbeat = withMusicChoice(track, "mood:upbeat");
    expect(editFromForm(upbeat)).toMatchObject({ musicTrack: null, production: { music: "upbeat" } });
    const none = withMusicChoice(upbeat, "mood:none");
    expect(editFromForm(none)).toMatchObject({ musicTrack: "none", production: { music: "none" } });
  });

  it("Text style: the template for the animated look, the captions for the productions, none where the look sets it", () => {
    const animated = formFromIdea(idea(), "coral");
    expect(textStyles(animated)).toEqual({ kind: "template", options: ["bold", "numbers", "story"] });
    expect(editFromForm(withTextStyle(animated, "numbers")).style).toBe("numbers");
    const footage = { ...animated, direction: "footage" as const };
    expect(textStyles(footage)).toEqual({ kind: "captions", options: ["bold", "editorial", "minimal"] });
    const styled = withTextStyle(footage, "editorial");
    expect(editFromForm(styled)).toMatchObject({ style: "bold", production: { captionStyle: "editorial" } });
    expect(textStyles({ ...animated, direction: "text_music" }).kind).toBe("fixed");
    expect(textStyles({ ...footage, format: "carousel" }).kind).toBe("fixed");
  });

  it("offers the hook, CTA and captions switches only where the renderer reads them", () => {
    expect(hookSwitchApplies({ direction: "animated", format: "reel" })).toBe(false);
    expect(hookSwitchApplies({ direction: "meme", format: "reel" })).toBe(true);
    expect(hookSwitchApplies({ direction: "meme", format: "carousel" })).toBe(false);
    expect(ctaSwitchApplies({ direction: "animated" })).toBe(false);
    expect(ctaSwitchApplies({ direction: "footage" })).toBe(true);
    expect(captionsApply({ direction: "animated", format: "reel" })).toBe(true);
    expect(captionsApply({ direction: "animated", format: "carousel" })).toBe(false);
    expect(captionsApply({ direction: "footage", format: "reel" })).toBe(false);
  });

  it("saves only the points the look shows", () => {
    const form = formFromIdea(idea({ direction: "footage" }), "coral");
    const six = { ...form, script: { ...SCRIPT, points: [...SCRIPT.points, ...SCRIPT.points] } };
    expect(maxPoints(six)).toBe(6);
    expect(editFromForm(six).script?.points).toHaveLength(6);
    const animated = { ...six, direction: "animated" as const };
    expect(maxPoints(animated)).toBe(4);
    expect(editFromForm(animated).script?.points).toHaveLength(4);
  });
});

describe("the live preview", () => {
  it("is silent and follows the form's words, look and format", () => {
    const form = { ...formFromIdea(idea({ direction: "footage" }), "coral"), format: "story", script: { ...SCRIPT, hook: "Edited" } };
    const props = previewProps(BASE, form, [{ url: "https://cdn.test/a.jpg", kind: "image" }]);
    expect(props).toMatchObject({ voiceUrl: null, words: [], voiceMs: 0, concept: true, format: "story", direction: "footage", captions: true });
    expect(props.script.hook).toBe("Edited");
    expect(props.media).toHaveLength(1);
    expect(props.plan).toBe(PLAN);
  });

  it("shows the selected text: the frame is inside that part's scene", () => {
    const form = formFromIdea(idea({ direction: "footage" }), "coral");
    const props = previewProps(BASE, form, []);
    const timeline = productionTimeline(props);
    for (const [index, part] of timeline.parts.entries()) {
      const frame = partFrame(props, part.part);
      const end = index + 1 < timeline.starts.length ? timeline.starts[index + 1] : timeline.durationInFrames;
      expect(frame).toBeGreaterThanOrEqual(timeline.starts[index]);
      expect(frame).toBeLessThan(end);
    }
    const animated = previewProps(BASE, formFromIdea(idea(), "coral"), []);
    const timing = reelTiming(animated);
    expect(partFrame(animated, 2)).toBeGreaterThanOrEqual(timing.starts[2]);
    expect(partFrame(animated, 2)).toBeLessThan(timing.starts[3]);
  });

  it("skips a part the video leaves out to the next one shown", () => {
    const form = { ...formFromIdea(idea({ direction: "footage" }), "coral"), production: production({ showHook: false, includeCta: false }) };
    const props = previewProps(BASE, form, []);
    expect(visibleParts(props)).toEqual([1, 2, 3, 4]);
    expect(partFrame(props, 0)).toBe(partFrame(props, 1));
    expect(partSlide(props, 0)).toBe(0);
    // The closing line is gone: the last part shown stands in for it.
    expect(partSlide(props, 5)).toBe(3);
  });

  it("puts a carousel's hook on the cover even with the hook switched off", () => {
    const form = { ...formFromIdea(idea({ direction: "footage" }), "coral"), format: "carousel", production: production({ showHook: false }) };
    const props = previewProps(BASE, form, []);
    expect(visibleParts(props)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(partSlide(props, 4)).toBe(4);
  });
});
