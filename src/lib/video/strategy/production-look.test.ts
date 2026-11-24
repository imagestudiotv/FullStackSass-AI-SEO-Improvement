import { describe, expect, it } from "vitest";

import { clipTextFromLook } from "../../../remotion/clip-text";
import { mergeProduction, productionOf } from "./production";

/** The customer's own text style on a Viral clip (client, 2026-11-24). */
describe("the saved text style", () => {
  const defaults = { narration: "natural", captionStyle: "bold", musicDirection: "auto", duration: "15-30", showHook: true, includeCta: false, defaultCta: null } as const;
  const read = (production: unknown) => productionOf({ production, voice: null, musicTrack: null, format: "reel" }, defaults);
  const style = { ...clipTextFromLook("meme", "Hello", { left: 80, top: 150, width: 860, align: "center" }), color: "#12ab34", y: 40 };

  it("is saved, read back and cleared", () => {
    const set = mergeProduction(read({}), { textStyle: style });
    expect(set?.textStyle).toEqual(style);
    expect(read(set).textStyle).toEqual(style);
    expect(mergeProduction(read(set), { textStyle: null })).toEqual(read({}));
  });

  it("refuses what is not a style, and brings numbers back into range", () => {
    for (const bad of ["red", 5, [], {}, { ...style, color: "red" }, { ...style, color: "#fff;background:url(x)" }, { ...style, font: "Comic Sans" }, { ...style, font: "constructor" }, { ...style, bg: "url(x)" }, { ...style, size: "90" }, { ...style, x: Number.NaN }]) {
      expect(mergeProduction(read({}), { textStyle: bad }), JSON.stringify(bad)).toBeNull();
    }
    const far = mergeProduction(read({}), { textStyle: { ...style, size: 9000, x: -50, y: 400, w: 500, stroke: 99, weight: 1, extra: "x" } })?.textStyle;
    expect(far).toMatchObject({ size: 160, x: 2, y: 96, w: 96, stroke: 6, weight: 400 });
    expect(far).not.toHaveProperty("extra");
    expect(read({ textStyle: { font: "nope" } })).not.toHaveProperty("textStyle");
  });
});
