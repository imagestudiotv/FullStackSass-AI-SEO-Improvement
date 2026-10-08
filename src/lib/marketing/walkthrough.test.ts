import { describe, expect, it } from "vitest";

import {
  WALKTHROUGH_VIDEO,
  walkthroughEmbedUrl,
  walkthroughPoster,
  walkthroughWatchUrl,
} from "./walkthrough";

describe("walkthrough video", () => {
  it("is the client's video", () => {
    expect(WALKTHROUGH_VIDEO.id).toBe("PqNu8DzBlTQ");
    expect(walkthroughWatchUrl()).toBe("https://www.youtube.com/watch?v=PqNu8DzBlTQ");
  });

  it("embeds from the privacy-enhanced host with the player's own controls", () => {
    const url = new URL(walkthroughEmbedUrl("de"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/PqNu8DzBlTQ");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      hl: "de",
      cc_lang_pref: "de",
    });
  });

  it("asks for no player API, no forced captions and no retired parameters", () => {
    const params = new URL(walkthroughEmbedUrl("en")).searchParams;
    for (const name of ["enablejsapi", "origin", "cc_load_policy", "modestbranding", "loop", "mute", "controls"]) {
      expect(params.has(name)).toBe(false);
    }
  });

  it("uses 16:9 poster sizes, with a fallback that exists for every video", () => {
    const poster = walkthroughPoster();
    expect(poster.srcSet).toContain("mqdefault.webp 320w");
    expect(poster.srcSet).toContain("maxresdefault.webp 1280w");
    expect(poster.fallback).toBe("https://i.ytimg.com/vi/PqNu8DzBlTQ/hqdefault.jpg");
  });
});
