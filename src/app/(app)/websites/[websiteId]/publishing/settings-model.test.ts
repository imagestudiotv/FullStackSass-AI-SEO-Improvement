import { describe, expect, it } from "vitest";

import {
  bottomBar,
  colourState,
  countChanges,
  firstInvalid,
  mergeAfterSave,
  nextDays,
  normalise,
  saveBarState,
  toFormValues,
  toInput,
  validate,
  type ArticleSettingsValues,
  type StoredArticleSettings,
} from "./settings-model";

const STORED: StoredArticleSettings = {
  articleStyle: "expert",
  internalLinkTarget: 3,
  targetWordCount: null,
  sitemapUrl: "",
  blogUrl: "",
  exampleArticleUrl: "",
  brandColor: "",
  imageStyle: "realistic",
  featuredImageStyle: "sketch",
  imageBrief: "",
  imageInstructions: "",
  tableOfContents: true,
  youtubeVideo: false,
  authorPerspective: true,
  mentionSimilarProducts: true,
  comparisonTable: true,
  poweredByLink: true,
  authorName: "",
  authorBio: "",
  tone: "",
  vocabulary: "",
  avoid: "",
  usps: "",
  facts: "",
  articleInstructions: "",
};

const base = (): ArticleSettingsValues => toFormValues(STORED);

describe("form values", () => {
  it("keeps Adaptive as null and numbers as typed text, and converts back for the action", () => {
    const values = base();
    expect(values.targetWordCount).toBeNull();
    expect(values.internalLinkTarget).toBe("3");
    expect(toInput({ ...values, targetWordCount: "1500" })).toMatchObject({ internalLinkTarget: 3, targetWordCount: 1500 });
    expect(toInput(values).targetWordCount).toBeNull();
  });
});

describe("validation mirrors the server's limits", () => {
  it("accepts the stored defaults", () => {
    expect(validate(base())).toEqual({});
  });

  it("flags internal links outside 0-20, a blank box and decimals instead of clamping them", () => {
    for (const bad of ["21", "-1", "", "2.5", "abc"]) {
      expect(validate({ ...base(), internalLinkTarget: bad }).internalLinkTarget).toEqual({ code: "links" });
    }
    for (const good of ["0", "20", " 7 "]) expect(validate({ ...base(), internalLinkTarget: good })).toEqual({});
  });

  it("checks a custom word count is 300-5000 and leaves Adaptive alone", () => {
    expect(validate({ ...base(), targetWordCount: "299" }).targetWordCount).toEqual({ code: "words" });
    expect(validate({ ...base(), targetWordCount: "5001" }).targetWordCount).toEqual({ code: "words" });
    expect(validate({ ...base(), targetWordCount: "" }).targetWordCount).toEqual({ code: "words" });
    expect(validate({ ...base(), targetWordCount: "1200" })).toEqual({});
    expect(validate({ ...base(), targetWordCount: null })).toEqual({});
  });

  it("refuses addresses the server would refuse", () => {
    const errors = validate({ ...base(), sitemapUrl: "example.com/sitemap.xml", blogUrl: "ftp://example.com", exampleArticleUrl: "https://example.com/a" });
    expect(errors.sitemapUrl).toEqual({ code: "url" });
    expect(errors.blogUrl).toEqual({ code: "url" });
    expect(errors.exampleArticleUrl).toBeUndefined();
  });

  it("refuses a brand colour that is not #rrggbb - the server would silently keep the old one", () => {
    for (const bad of ["#038", "003388", "#003388ff", "rgb(0,0,0)", "blue"]) {
      expect(validate({ ...base(), brandColor: bad }).brandColor).toEqual({ code: "colour" });
    }
    expect(validate({ ...base(), brandColor: " #003388 " })).toEqual({});
    expect(validate({ ...base(), brandColor: "" })).toEqual({});
  });

  it("says when facts or differentiators would be truncated", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => `Fact ${i}`).join("\n");
    expect(validate({ ...base(), facts: thirteen }).facts).toEqual({ code: "tooManyLines", max: 12, over: 1 });
    // Blank lines do not count, as on the server.
    expect(validate({ ...base(), usps: "a\n\n\nb\n" })).toEqual({});
    expect(validate({ ...base(), usps: `ok\n${"x".repeat(201)}` }).usps).toEqual({ code: "lineTooLong", line: 2, max: 200 });
  });

  it("flags text over the server's character limits", () => {
    expect(validate({ ...base(), tone: "x".repeat(501) }).tone).toEqual({ code: "tooLong", max: 500 });
    expect(validate({ ...base(), articleInstructions: "x".repeat(2001) }).articleInstructions).toEqual({ code: "tooLong", max: 2000 });
    expect(validate({ ...base(), articleInstructions: "x".repeat(2000) })).toEqual({});
  });

  it("points at the first problem in page order", () => {
    expect(firstInvalid(validate({ ...base(), avoid: "x".repeat(501), sitemapUrl: "nope" }))).toBe("sitemapUrl");
    expect(firstInvalid({})).toBeNull();
  });
});

describe("one brand colour value", () => {
  it("is none, valid or invalid - never a stand-in black", () => {
    expect(colourState("")).toEqual({ kind: "none" });
    expect(colourState("  ")).toEqual({ kind: "none" });
    expect(colourState("#00AAFF")).toEqual({ kind: "valid", hex: "#00aaff" });
    expect(colourState("#038")).toEqual({ kind: "invalid" });
  });
});

describe("normalise is what the server stores", () => {
  it("trims, lower-cases the colour, normalises addresses and drops blank list lines", () => {
    const stored = normalise({
      ...base(),
      internalLinkTarget: "07",
      targetWordCount: "1500",
      sitemapUrl: " https://Example.com ",
      brandColor: " #00AAFF",
      tone: "  Warm ",
      facts: " One \n\n Two ",
    });
    expect(stored).toMatchObject({
      internalLinkTarget: "7",
      targetWordCount: "1500",
      sitemapUrl: "https://example.com/",
      brandColor: "#00aaff",
      tone: "Warm",
      facts: "One\nTwo",
    });
  });
});

describe("a save while the person keeps typing", () => {
  it("marks only the snapshot that was sent as saved and keeps newer edits pending", () => {
    const saved = base();
    // Sent: a new tone. While the request was in flight: a different word to avoid, and the tone edited again.
    const sent = { ...saved, tone: "Warm " };
    const stored = normalise(sent);
    const current = { ...sent, avoid: "cheap", internalLinkTarget: "5" };

    const after = mergeAfterSave(current, sent, stored);
    // The sent field takes the stored (trimmed) value...
    expect(after.tone).toBe("Warm");
    // ...newer edits survive and are still unsaved against the new baseline.
    expect(after.avoid).toBe("cheap");
    expect(after.internalLinkTarget).toBe("5");
    expect(countChanges(after, stored)).toBe(2);
  });

  it("does not overwrite a field that was edited again after being sent", () => {
    const sent = { ...base(), tone: "Warm" };
    const current = { ...sent, tone: "Warmer" };
    const after = mergeAfterSave(current, sent, normalise(sent));
    expect(after.tone).toBe("Warmer");
    expect(countChanges(after, normalise(sent))).toBe(1);
  });

  it("leaves nothing pending when nothing changed during the save", () => {
    const sent = { ...base(), youtubeVideo: true };
    const stored = normalise(sent);
    expect(countChanges(mergeAfterSave(sent, sent, stored), stored)).toBe(0);
  });

  it("counts Custom then Adaptive again as no change", () => {
    const saved = base();
    expect(countChanges({ ...saved, targetWordCount: "1200" }, saved)).toBe(1);
    expect(countChanges({ ...saved, targetWordCount: null }, saved)).toBe(0);
  });
});

describe("the bottom bar", () => {
  it("offers 'keep the defaults' only to an editor who never saved and changed nothing", () => {
    expect(bottomBar({ canEdit: true, reviewed: false, changes: 0 })).toBe("confirm");
    expect(bottomBar({ canEdit: true, reviewed: false, changes: 2 })).toBe("save");
    expect(bottomBar({ canEdit: true, reviewed: true, changes: 0 })).toBe("save");
  });

  it("shows nothing to a viewer", () => {
    expect(bottomBar({ canEdit: false, reviewed: false, changes: 0 })).toBe("none");
    expect(bottomBar({ canEdit: false, reviewed: true, changes: 3 })).toBe("none");
  });

  it("says saving, failed, pending, saved or clean - and 'saved' only after a confirmed save", () => {
    expect(saveBarState({ changes: 2, saving: true, failure: null, savedThisVisit: false })).toEqual({ kind: "saving", count: 2 });
    expect(saveBarState({ changes: 2, saving: false, failure: "Nope", savedThisVisit: false })).toEqual({ kind: "failed", error: "Nope", count: 2 });
    expect(saveBarState({ changes: 1, saving: false, failure: null, savedThisVisit: true })).toEqual({ kind: "dirty", count: 1 });
    expect(saveBarState({ changes: 0, saving: false, failure: null, savedThisVisit: true })).toEqual({ kind: "saved" });
    expect(saveBarState({ changes: 0, saving: false, failure: null, savedThisVisit: false })).toEqual({ kind: "clean" });
  });
});

describe("writing days", () => {
  it("expands 'any day' to all seven before switching one off", () => {
    expect(nextDays([], 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("adds and removes days, sorted as the scheduler counts them (0 = Sunday)", () => {
    expect(nextDays([1, 3], 0)).toEqual([0, 1, 3]);
    expect(nextDays([0, 1, 3], 1)).toEqual([0, 3]);
  });

  it("turns the last day off into 'any day' rather than never", () => {
    expect(nextDays([2], 2)).toEqual([]);
  });
});
