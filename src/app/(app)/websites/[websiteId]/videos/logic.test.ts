import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/video/settings";

import {
  browse,
  categoryCounts,
  isPageUndo,
  settingsChanges,
  settingsProblems,
  splitHashtags,
  undoTarget,
  viralSplit,
  visibleIdeas,
  type ProfileForm,
  type UndoKeyEvent,
} from "./logic";

/**
 * The Social Content page's rules that carry risk: the filters the deck and
 * the chips share, Ctrl/Cmd+Z never taking a field's own undo, and the
 * settings form sending only what changed, validated.
 */

const idea = (id: string, category: string, format: string) => ({ id, category, format });
const IDEAS = [
  idea("a", "viral", "reel"),
  idea("b", "educational", "carousel"),
  idea("c", "viral", "story"),
  idea("d", "promotional", "reel"),
  idea("e", "authority", "reel"),
];

describe("idea filters", () => {
  it("combines the category and the format, and leaves out ideas handled on this screen", () => {
    expect(visibleIdeas(IDEAS, new Set(), "viral", "all").map((i) => i.id)).toEqual(["a", "c"]);
    expect(visibleIdeas(IDEAS, new Set(), "viral", "reel").map((i) => i.id)).toEqual(["a"]);
    expect(visibleIdeas(IDEAS, new Set(["a"]), "viral", "reel")).toEqual([]);
    expect(visibleIdeas(IDEAS, new Set(), "all", "carousel").map((i) => i.id)).toEqual(["b"]);
  });

  it("counts each chip within the chosen format, so a chip never promises hidden ideas", () => {
    expect(categoryCounts(IDEAS, new Set(), "all")).toEqual({ all: 5, viral: 2, educational: 1, authority: 1, promotional: 1 });
    expect(categoryCounts(IDEAS, new Set(["d"]), "reel")).toEqual({ all: 2, viral: 1, educational: 0, authority: 1, promotional: 0 });
  });

  it("browses round the filtered ideas", () => {
    expect(browse(0, -1, 3)).toBe(2);
    expect(browse(2, 1, 3)).toBe(0);
    expect(browse(0, 1, 0)).toBe(0);
  });
});

describe("Ctrl/Cmd+Z", () => {
  const field = (selector: string) => ({ closest: (query: string) => (query.split(",").some((part) => part.trim() === selector) ? {} : null) });
  const press = (change: Partial<UndoKeyEvent> = {}): UndoKeyEvent => ({
    key: "z",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    target: { closest: () => null },
    ...change,
  });

  it("is the page's undo on the page itself, with Ctrl or Cmd", () => {
    expect(isPageUndo(press(), false)).toBe(true);
    expect(isPageUndo(press({ ctrlKey: false, metaKey: true, key: "Z" }), false)).toBe(true);
  });

  it("leaves a field's own undo alone", () => {
    expect(isPageUndo(press({ target: field("input") }), false)).toBe(false);
    expect(isPageUndo(press({ target: field("textarea") }), false)).toBe(false);
    expect(isPageUndo(press({ target: field("select") }), false)).toBe(false);
    expect(isPageUndo(press({ target: { closest: () => null, isContentEditable: true } }), false)).toBe(false);
  });

  it("does nothing while a dialog or menu is open, with Shift (redo) or Alt, or on a held key", () => {
    expect(isPageUndo(press(), true)).toBe(false);
    expect(isPageUndo(press({ shiftKey: true }), false)).toBe(false);
    expect(isPageUndo(press({ altKey: true }), false)).toBe(false);
    expect(isPageUndo(press({ repeat: true }), false)).toBe(false);
    expect(isPageUndo(press({ ctrlKey: false }), false)).toBe(false);
  });

  it("takes back a make only within its seconds, and a skip until the next make", () => {
    expect(undoTarget({ kind: "make", id: "a", at: 1_000 }, 10_999, 10)).toEqual({ kind: "make", id: "a", at: 1_000 });
    expect(undoTarget({ kind: "make", id: "a", at: 1_000 }, 11_001, 10)).toBeNull();
    expect(undoTarget({ kind: "skip", id: "b", at: 1_000 }, 999_999, 10)).toEqual({ kind: "skip", id: "b", at: 1_000 });
    expect(undoTarget(null, 0, 10)).toBeNull();
  });
});

describe("content strategy", () => {
  it("shows the daily split the slider means", () => {
    expect(viralSplit(40)).toEqual({ viral: 8, other: 12 });
    expect(viralSplit(0)).toEqual({ viral: 0, other: 20 });
    expect(viralSplit(100)).toEqual({ viral: 20, other: 0 });
  });

  it("splits trailing hashtags from the post text", () => {
    expect(splitHashtags("Plan the light first.\n#wedding #sorrento")).toEqual({ text: "Plan the light first.", hashtags: "#wedding #sorrento" });
    expect(splitHashtags("No tags here")).toEqual({ text: "No tags here", hashtags: "" });
  });
});

describe("settings form", () => {
  const profile: ProfileForm = { targetAudience: "", language: "English", country: "", tone: "", avoid: "", priorityTopics: "", tonePreset: "professional" };

  it("sends only what changed, normalised", () => {
    const form = { ...DEFAULT_SETTINGS, viralMix: 63, defaultCta: "  Follow us  ", platforms: ["instagram", "instagram", "linkedin"] as typeof DEFAULT_SETTINGS.platforms };
    expect(settingsChanges(DEFAULT_SETTINGS, form)).toEqual({ viralMix: 60, defaultCta: "Follow us", platforms: ["instagram", "linkedin"] });
    expect(settingsChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual({});
  });

  it("keeps the older music switch in step with the music direction", () => {
    expect(settingsChanges(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, musicDirection: "none" })).toEqual({ musicDirection: "none", music: false });
  });

  it("keeps a legacy null frequency unless the customer picks one", () => {
    const legacy = { ...DEFAULT_SETTINGS, frequency: null };
    expect(settingsChanges(legacy, { ...legacy })).toEqual({});
    expect(settingsChanges(legacy, { ...legacy, frequency: "1_day" })).toEqual({ frequency: "1_day" });
  });

  it("refuses a form without a format, an overlong CTA or an unknown value before sending", () => {
    expect(settingsProblems({ ...DEFAULT_SETTINGS, formats: [] }, profile)).toContain("no_format");
    expect(settingsProblems({ ...DEFAULT_SETTINGS, defaultCta: "x".repeat(121) }, profile)).toContain("cta_too_long");
    expect(settingsProblems({ ...DEFAULT_SETTINGS, goal: "fame" as never }, profile)).toContain("bad_value");
    expect(settingsProblems(DEFAULT_SETTINGS, profile)).toEqual([]);
  });
});
