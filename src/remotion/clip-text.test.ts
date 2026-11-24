import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CAPTION_LOOKS } from "./caption-looks";
import { boundClipText, CLIP_FONT_KEYS, CLIP_FRAME, CLIP_PRESETS, cleanClipText, clipPresetOf, clipTextFromLook, clipTextLayout, shownClipText, withClipPreset } from "./clip-text";

/** The text on a Viral clip as the customer styles it (client, 2026-11-24). */
describe("the text on a Viral clip", () => {
  const place = { left: 80, top: 150, width: 860, align: "center" as const };
  const style = clipTextFromLook("native", "POV: your socials post themselves while you nap", place);

  it("starts from every look as a valid style, at the look's place", () => {
    for (const look of CAPTION_LOOKS) {
      const from = clipTextFromLook(look, "POV: hello", place);
      expect(cleanClipText(from), look).toEqual(from);
      expect(clipTextLayout("POV: hello", from)).toMatchObject({ left: 80, width: 860, size: from.size });
      expect(Math.round((from.y / 100) * CLIP_FRAME.height)).toBe(150);
    }
  });

  it("never leaves the frame at the sides, and is made smaller when it could not fit", () => {
    const long = "Donaudampfschifffahrtsgesellschaftskapitän ".repeat(8);
    for (const font of CLIP_FONT_KEYS)
      for (const size of [28, 90, 160])
        for (const w of [25, 60, 96])
          for (const y of [0, 50, 96])
            for (const x of [-20, 40, 120])
              for (const bg of ["none", "dark"] as const) {
                const box = clipTextLayout(long, { ...style, font, size, w, y, x, bg });
                expect(box.left).toBeGreaterThanOrEqual(0);
                expect(box.left + box.width).toBeLessThanOrEqual(CLIP_FRAME.width);
                expect(box.size).toBeGreaterThanOrEqual(28);
                expect(box.size).toBeLessThanOrEqual(size);
              }
  });

  it("keeps the size chosen for a text that fits", () => {
    expect(clipTextLayout("POV: your socials post themselves while you nap", { ...style, size: 100 }).size).toBe(100);
    // The longest word stays on one line.
    expect(clipTextLayout("cheapest", { ...style, size: 160, w: 40, case: "upper" }).size).toBeLessThan(80);
    expect(clipTextLayout("word ".repeat(60), { ...style, size: 160, w: 25 }).size).toBeLessThan(80);
  });

  it("takes a weight its face has", () => {
    expect(boundClipText({ ...style, font: "anton", weight: 900 }).weight).toBe(400);
    expect(boundClipText({ ...style, font: "arimo", weight: 900 }).weight).toBe(700);
  });

  it("changes only the words' case", () => {
    expect(shownClipText("Ștefan și Öl", { case: "upper" })).toBe("ȘTEFAN ȘI ÖL");
    expect(shownClipText("POV", { case: "lower" })).toBe("pov");
  });

  it("has the mockup's quick styles, which keep the size and place (but Subtitle)", () => {
    const moved = { ...style, size: 100, x: 10, y: 55 };
    for (const preset of CLIP_PRESETS) {
      const next = withClipPreset(moved, preset);
      expect(cleanClipText(next)).toEqual(next);
      if (preset === "subtitle") expect(next).toMatchObject({ size: 56, y: 70 });
      else expect(next).toMatchObject({ size: 100, y: 55 });
      expect(withClipPreset(next, preset)).toEqual(next);
    }
    expect(clipPresetOf(withClipPreset(moved, "orange"))).toBe("orange");
    expect(clipPresetOf({ ...withClipPreset(moved, "orange"), color: "#123456" })).toBeNull();
  });

  it("has its font files and licences shipped with the app", () => {
    const dir = path.join(process.cwd(), "public", "video-fonts");
    for (const [name, weights] of [["arimo", [500, 700]], ["gelasio", [500, 700]], ["fira-sans", [500, 700, 900]]] as const) {
      for (const weight of weights) for (const subset of ["latin", "latin-ext"]) expect(existsSync(path.join(dir, `${name}-${subset}-${weight}-normal.woff2`)), name).toBe(true);
      expect(existsSync(path.join(dir, `LICENSE-${name}.txt`)), name).toBe(true);
    }
  });
});
