import { describe, expect, it } from "vitest";

import { MUSIC_TRACKS, ideaTrack, pickProductionTrack, pickTrack } from "./music";

/** The idea's preview plays the very track its video is made with (client, 2026-11-23: the preview had no music). */
describe("an idea's track", () => {
  const base = { id: "idea-1", style: "bold", musicTrack: null, direction: "meme" as const, hasProduction: true, music: "auto" as const, planMood: null, websiteMusic: true };

  it("is the one picked on Create when none is chosen yet: the same every time", () => {
    expect(ideaTrack(base)).toEqual(pickProductionTrack("idea-1", "meme", "auto", null));
    expect(ideaTrack(base)).toEqual(ideaTrack({ ...base }));
    expect(ideaTrack({ ...base, planMood: "cinematic" })?.mood).toBe("cinematic");
  });

  it("is the customer's own choice, or none", () => {
    const chosen = MUSIC_TRACKS[1];
    expect(ideaTrack({ ...base, musicTrack: chosen.id })).toEqual(chosen);
    expect(ideaTrack({ ...base, musicTrack: "none" })).toBeNull();
    expect(ideaTrack({ ...base, music: "none" })).toBeNull();
  });

  it("follows the website's music switch for an animated video saved before productions", () => {
    const legacy = { ...base, direction: "animated" as const, hasProduction: false };
    expect(ideaTrack(legacy)).toEqual(pickTrack("idea-1", "bold"));
    expect(ideaTrack({ ...legacy, websiteMusic: false })).toBeNull();
  });
});
