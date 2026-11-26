import { describe, expect, it } from "vitest";

import type { EditorialImage, ReelProps } from "../lib/video/formats";
import { cleanClipText } from "./clip-text";
import { coverFrame } from "./cover";
import {
  EDITORIAL_FRAMES,
  EDITORIAL_RED,
  editorialAccent,
  editorialBounds,
  editorialDefaultStyle,
  editorialImageFor,
  editorialImages,
  editorialLayout,
  editorialScene,
  editorialSettledFrame,
  editorialStyleOf,
  editorialWords,
  hasHighlight,
  highlightRuns,
  plainScript,
  stripHighlight,
  withoutStars,
} from "./editorial";
import { productionTimeline } from "./production";
import { isProduction, type ProductionReelProps } from "./props";

/** The editorial look (client, 2026-11-26): the website's own pictures under big, editable type. */

const image = (n: number): EditorialImage => ({ url: `https://example.com/${n}.jpg`, alt: null, source: "article", pageUrl: null, width: 1200, height: 800 });

describe("highlighted words", () => {
  it("never shows the stars", () => {
    expect(stripHighlight("Instagram just gave you *an advantage*. *Use it*")).toBe("Instagram just gave you an advantage. Use it");
    expect(stripHighlight("a lone * star")).toBe("a lone star");
    expect(stripHighlight("no stars here ")).toBe("no stars here ");
  });

  it("cuts a text into plain and highlighted runs", () => {
    expect(highlightRuns("Gave you *an advantage*. *Use it*")).toEqual([
      { text: "Gave you ", strong: false },
      { text: "an advantage", strong: true },
      { text: ". ", strong: false },
      { text: "Use it", strong: true },
    ]);
    expect(highlightRuns("half *open")).toEqual([{ text: "half open", strong: false }]);
    expect(hasHighlight("*Use it*")).toBe(true);
    expect(hasHighlight("Use it")).toBe(false);
  });

  it("highlights whole words, punctuation included, and picks the closing words when none are starred", () => {
    expect(editorialWords("You got *an advantage*. Use it")).toEqual([
      { text: "You", strong: false },
      { text: "got", strong: false },
      { text: "an", strong: true },
      { text: "advantage.", strong: true },
      { text: "Use", strong: false },
      { text: "it", strong: false },
    ]);
    const auto = editorialWords("Post three carousels every single week");
    expect(auto.some((word) => word.strong)).toBe(true);
    expect(auto[0].strong).toBe(false);
    expect(editorialWords("Post three carousels", false).some((word) => word.strong)).toBe(false);
  });

  it("strips the script for every other look, and leaves the editorial one as written", () => {
    const script = { hook: "*Use it*", points: [{ title: "a *b*", detail: "c *d*", stat: null }], proof: "*p*", cta: "*c*" };
    expect(plainScript(script)).toEqual({ hook: "Use it", points: [{ title: "a b", detail: "c d", stat: null }], proof: "p", cta: "c" });
    const base = { script, production: { ctaText: "*Go*" } } as unknown as ReelProps & Partial<ProductionReelProps>;
    const footage = { ...base, direction: "footage", plan: { scenes: [] } } as unknown as ProductionReelProps;
    expect(withoutStars(footage).script.hook).toBe("Use it");
    expect(withoutStars(footage).production?.ctaText).toBe("Go");
    const editorial = { ...base, direction: "editorial", plan: { images: [] } } as unknown as ProductionReelProps;
    expect(withoutStars(editorial)).toBe(editorial);
  });
});

describe("the default style", () => {
  it("is the reference: the Impact-style face in white capitals, left, at the top, valid for the editor", () => {
    for (const format of ["carousel", "reel", "story"] as const) {
      const style = editorialDefaultStyle(format, null);
      expect(style).toMatchObject({ font: "anton", case: "upper", color: "#ffffff", align: "left", bg: "none", accent: EDITORIAL_RED });
      expect(cleanClipText(style)).toEqual(style);
      expect(style.y).toBeLessThan(20);
      const bounds = editorialBounds(format);
      expect(Math.round((style.x / 100) * EDITORIAL_FRAMES[format].width)).toBe(bounds.left);
    }
  });

  it("takes the brand's colour as the highlight when it stands out on black, else red", () => {
    expect(editorialAccent({ primary: "#4f46e5", accent: "#f59e0b" })).toBe("#f59e0b");
    expect(editorialAccent({ primary: "#1f2937", accent: "#94a3b8" })).toBe(EDITORIAL_RED);
    expect(editorialAccent({ primary: "#ffffff", accent: "#eeeeee" })).toBe(EDITORIAL_RED);
    expect(editorialAccent(null)).toBe(EDITORIAL_RED);
  });

  it("keeps the customer's own style, adding a highlight colour when it has none", () => {
    const own = { ...editorialDefaultStyle("reel", null), font: "inter" as const, weight: 900, accent: null };
    const style = editorialStyleOf({ textStyle: own }, "reel", { primary: "#4f46e5", accent: "#f59e0b" });
    expect(style.font).toBe("inter");
    expect(style.accent).toBe("#f59e0b");
    expect(editorialStyleOf({ textStyle: null }, "carousel", null)).toEqual(editorialDefaultStyle("carousel", null));
  });
});

describe("pictures and layouts", () => {
  it("gives the cover the first picture and reuses them in order", () => {
    const images = [image(1), image(2)];
    expect(editorialImageFor(images, 0)?.url).toBe(images[0].url);
    expect(editorialImageFor(images, 1)?.url).toBe(images[1].url);
    expect(editorialImageFor(images, 2)?.url).toBe(images[0].url);
    expect(editorialImageFor([], 0)).toBeNull();
    expect(editorialImageFor(null, 3)).toBeNull();
  });

  it("uses the plan's pictures, else the idea's own pictures, never videos", () => {
    expect(editorialImages({ images: [image(1)] }, [{ url: "x.jpg", kind: "image" }])).toHaveLength(1);
    const own = editorialImages({ images: [] }, [{ url: "a.jpg", kind: "image" }, { url: "a.jpg", kind: "image" }, { url: "v.mp4", kind: "video" }]);
    expect(own.map((item) => item.url)).toEqual(["a.jpg"]);
  });

  it("varies the layout along the video, with type slides when there is no picture", () => {
    expect(editorialLayout(0, "hook", true)).toBe("cover");
    expect(editorialLayout(0, "hook", false)).toBe("cover");
    expect([1, 2, 3, 4].map((i) => editorialLayout(i, "point", true))).toEqual(["bleed", "card", "frame", "bleed"]);
    expect(editorialLayout(2, "point", false)).toBe("type");
    expect(editorialLayout(5, "cta", true)).toBe("end");
  });

  it("frames a diagram as a card, never under the words, and closes on plain type after one", () => {
    expect(editorialLayout(0, "hook", true, true)).toBe("cover");
    expect([1, 2, 3, 4].map((i) => editorialLayout(i, "point", true, true))).toEqual(["card", "card", "card", "card"]);
    expect(editorialLayout(5, "cta", true, true)).toBe("type");
  });

  it("keeps the text inside the frame and puts the picture on the side with more room", () => {
    const style = editorialDefaultStyle("carousel", null);
    const long = "Donaudampfschifffahrtsgesellschaft ".repeat(6);
    for (const layout of ["cover", "bleed", "card", "frame", "end", "type"] as const) {
      const scene = editorialScene(long, "A supporting line that is not short at all, for sure.", style, "carousel", layout);
      expect(scene.text.top).toBeGreaterThanOrEqual(scene.bounds.top);
      expect(scene.text.size).toBeGreaterThanOrEqual(28);
      expect(scene.text.left + scene.text.width).toBeLessThanOrEqual(EDITORIAL_FRAMES.carousel.width);
    }
    const top = editorialScene("Short title", null, style, "carousel", "card");
    expect(top.textTop).toBe(true);
    expect(top.photo!.top).toBeGreaterThan(top.text.top + top.text.height);
    const low = editorialScene("Short title", null, { ...style, y: 80 }, "carousel", "card");
    expect(low.textTop).toBe(false);
    expect(low.photo!.top + low.photo!.height).toBeLessThan(low.text.top);
  });
});

describe("the editorial reel", () => {
  const props = {
    style: "story",
    brand: { name: "Rankwell", domain: "rankwell.io", primary: "#4f46e5", accent: "#f59e0b", background: "#eef0ff", text: "#14141c", logoUrl: null },
    script: { hook: "Gave you *an advantage*", points: [{ title: "One", detail: "d", stat: null }, { title: "Two", detail: "", stat: null }], proof: "Proof", cta: "Follow" },
    voiceUrl: null,
    words: [],
    sceneStartsMs: [],
    voiceMs: 0,
    music: null,
    media: [],
    captions: true,
    direction: "editorial",
    plan: { direction: "editorial", pacing: "medium", images: [image(1)] },
  } as unknown as ProductionReelProps;

  it("is a production even without scenes", () => {
    expect(isProduction(props)).toBe(true);
    expect(isProduction({ ...props, direction: "footage" })).toBe(false);
    expect(productionTimeline(props).parts.map((part) => part.role)).toEqual(["hook", "point", "point", "proof", "cta"]);
  });

  it("takes its cover once the hook's words are up", () => {
    expect(coverFrame(props)).toBeGreaterThanOrEqual(editorialSettledFrame(3));
    expect(coverFrame(props)).toBeLessThan(productionTimeline(props).starts[1]);
  });
});
