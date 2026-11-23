import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CAPTION_LOOKS, LOOK_SPECS, captionLookFor, hookCaptionLook, outlineShadow, povCaptionLook } from "./caption-looks";

/** The Viral videos' text looks (client, 2026-11-23: "missing the changing of the font text character etc as reference"). */
describe("the caption looks", () => {
  it("are six, each with a sane size range", () => {
    expect(CAPTION_LOOKS).toHaveLength(6);
    for (const look of CAPTION_LOOKS) {
      const spec = LOOK_SPECS[look];
      expect(spec.min).toBeLessThan(spec.max);
      expect(spec.charEm).toBeGreaterThan(0.3);
    }
  });

  it("are the same for the same video and varied across videos", () => {
    expect(captionLookFor("a video")).toBe(captionLookFor("a video"));
    const seen = new Set(Array.from({ length: 120 }, (_, i) => captionLookFor(`video ${i}`)));
    expect(seen.size).toBe(CAPTION_LOOKS.length);
  });

  it("keep a POV video's look when its line is edited (it comes from the clip and the video's own mirror/zoom/hue)", () => {
    const pov = { id: "2026-11-21-pov-wizard-cat-typing", mirror: true, zoom: 1.06, hue: 5 };
    expect(povCaptionLook(pov)).toBe(povCaptionLook({ ...pov }));
    const looks = new Set([1, 1.02, 1.04, 1.06, 1.08, 1.1].flatMap((zoom) => [-6, -2, 2, 6].map((hue) => povCaptionLook({ ...pov, zoom, hue }))));
    expect(looks.size).toBeGreaterThan(3);
    expect(hookCaptionLook("clip", "Wait for it")).toBe(hookCaptionLook("clip", " Wait for it "));
  });

  it("outline white letters in eight directions", () => {
    expect(outlineShadow(2).split(", ")).toHaveLength(9);
    expect(outlineShadow(0)).not.toContain("#000");
  });

  it("have their font files and licences shipped with the app", () => {
    const dir = path.join(process.cwd(), "public", "video-fonts");
    for (const file of ["anton-latin-400-normal.woff2", "anton-latin-ext-400-normal.woff2", "courier-prime-latin-700-normal.woff2", "courier-prime-latin-ext-700-normal.woff2", "permanent-marker-latin-400-normal.woff2", "LICENSE-anton.txt", "LICENSE-courier-prime.txt", "LICENSE-permanent-marker.txt"]) {
      expect(existsSync(path.join(dir, file)), file).toBe(true);
    }
  });
});
