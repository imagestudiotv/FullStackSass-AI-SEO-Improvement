import { describe, expect, it } from "vitest";

import { chosenLook } from "../../../remotion/caption-looks";
import { mergeProduction, productionOf } from "./production";

/** The text look the customer chose for a Viral clip (client, 2026-11-24). */
describe("the chosen text look", () => {
  const defaults = { narration: "natural", captionStyle: "bold", musicDirection: "auto", duration: "15-30", showHook: true, includeCta: false, defaultCta: null } as const;
  const read = (production: unknown) => productionOf({ production, voice: null, musicTrack: null, format: "reel" }, defaults);

  it("is saved, read back and cleared, and nothing else is accepted", () => {
    const set = mergeProduction(read({}), { captionLook: "box" });
    expect(set?.captionLook).toBe("box");
    expect(read(set).captionLook).toBe("box");
    expect(mergeProduction(read(set), { captionLook: null })).toEqual(read({}));
    expect(mergeProduction(read({}), { captionLook: "comic" })).toBeNull();
    expect(read({ captionLook: "comic" })).not.toHaveProperty("captionLook");
  });

  it("wins over the look picked for the video", () => {
    expect(chosenLook("meme", "native")).toBe("meme");
    expect(chosenLook(null, "native")).toBe("native");
    expect(chosenLook("comic", "native")).toBe("native");
  });
});
