import { describe, expect, it } from "vitest";

import { normaliseSlug } from "@/lib/articles/generate";

import {
  beginSave,
  dirtyKeys,
  discardFields,
  editField,
  initDraft,
  keepLocal,
  receiveSaved,
  saveFailed,
  saveSucceeded,
  slugDropsLetters,
  slugFromInput,
  type ArticleFields,
  type DraftState,
} from "./draft-state";

/**
 * The article page's working copy: what counts as unsaved, what a save's
 * answer settles, and what a background refresh may and may not change.
 */

const SAVED: ArticleFields = {
  title: "Wedding films in Italy",
  metaDescription: "Short films of weddings on Lake Como.",
  slug: "wedding-films-italy",
  bodyHtml: "<p>First paragraph.</p>",
};

/** The server's stored form after a save of `sent` (trimmed, tidied). */
function stored(previous: ArticleFields, sent: Partial<ArticleFields>): ArticleFields {
  return {
    title: sent.title !== undefined ? sent.title.trim() : previous.title,
    metaDescription: sent.metaDescription !== undefined ? sent.metaDescription.trim() : previous.metaDescription,
    slug: sent.slug !== undefined ? (normaliseSlug(sent.slug) ?? "") : previous.slug,
    bodyHtml: sent.bodyHtml ?? previous.bodyHtml,
  };
}

function start(state: DraftState) {
  const started = beginSave(state);
  if (!started) throw new Error("nothing to save");
  return started;
}

describe("what counts as unsaved", () => {
  it("every field a Save sends is tracked, the meta description and the address included", () => {
    let state = initDraft(SAVED);
    expect(dirtyKeys(state)).toEqual([]);
    state = editField(state, "metaDescription", "A new description.");
    state = editField(state, "slug", "films-italy");
    expect(dirtyKeys(state)).toEqual(["metaDescription", "slug"]);
    state = editField(state, "title", "A new title");
    state = editField(state, "bodyHtml", "<p>Changed.</p>");
    expect(dirtyKeys(state)).toEqual(["title", "metaDescription", "slug", "bodyHtml"]);
  });

  it("compares as the server stores: spaces the save trims and an address it tidies to the same are not changes", () => {
    let state = initDraft(SAVED);
    state = editField(state, "title", "  Wedding films in Italy ");
    state = editField(state, "slug", "Wedding Films Italy!");
    state = editField(state, "metaDescription", "Short films of weddings on Lake Como.   ");
    expect(dirtyKeys(state)).toEqual([]);
  });

  it("the editor re-serialising the same text is not a change", () => {
    const state = editField(initDraft(SAVED), "bodyHtml", "<p>First paragraph.</p><p></p>");
    expect(dirtyKeys(state)).toEqual([]);
  });

  it("a stored value that is not in tidied form does not look unsaved before anyone types", () => {
    const legacy = { ...SAVED, slug: "Legacy_Slug" };
    expect(dirtyKeys(initDraft(legacy))).toEqual([]);
  });
});

describe("background refreshes", () => {
  it("never overwrite a field being edited, and a field nobody touched follows the server", () => {
    let state = editField(initDraft(SAVED), "title", "My own title");
    // A rewrite finished: new text and description arrive.
    const rewritten = { ...SAVED, metaDescription: "Rewritten description.", bodyHtml: "<p>Rewritten.</p>" };
    state = receiveSaved(state, rewritten);
    expect(state.values.title).toBe("My own title");
    expect(state.values.metaDescription).toBe("Rewritten description.");
    expect(state.values.bodyHtml).toBe("<p>Rewritten.</p>");
    expect(dirtyKeys(state)).toEqual(["title"]);
    expect(state.conflicts).toEqual([]);
  });

  it("a refresh with nothing new changes nothing (same state object)", () => {
    const state = editField(initDraft(SAVED), "title", "Draft");
    expect(receiveSaved(state, { ...SAVED })).toBe(state);
  });

  it("an edited field that also changed on the server is named as a conflict, keeping the local text until the person decides", () => {
    let state = editField(initDraft(SAVED), "bodyHtml", "<p>My edit.</p>");
    state = receiveSaved(state, { ...SAVED, bodyHtml: "<p>Someone else's version.</p>" });
    expect(state.values.bodyHtml).toBe("<p>My edit.</p>");
    expect(state.conflicts).toEqual(["bodyHtml"]);

    const loaded = discardFields(state, state.conflicts);
    expect(loaded.values.bodyHtml).toBe("<p>Someone else's version.</p>");
    expect(loaded.conflicts).toEqual([]);
    expect(dirtyKeys(loaded)).toEqual([]);

    const kept = keepLocal(state);
    expect(kept.conflicts).toEqual([]);
    expect(dirtyKeys(kept)).toEqual(["bodyHtml"]);
  });

  it("keeps the editor's own markup for an untouched text that saves to the same thing (no caret jump)", () => {
    const state = receiveSaved(editField(initDraft(SAVED), "title", "x"), {
      ...SAVED,
      title: "Other",
      bodyHtml: "<p>First paragraph.</p><p></p>",
    });
    expect(state.values.bodyHtml).toBe("<p>First paragraph.</p>");
  });
});

describe("saving", () => {
  it("sends only the fields that changed", () => {
    const state = editField(initDraft(SAVED), "slug", "Films Italy");
    expect(start(state).payload).toEqual({ slug: "Films Italy" });
    expect(beginSave(initDraft(SAVED))).toBeNull();
  });

  it("a confirmed save settles what it carried and shows the stored form, whichever arrives first", () => {
    // Answer first, then the refreshed article.
    let state = editField(initDraft(SAVED), "slug", "Films Italy");
    let started = start(state);
    state = saveSucceeded(started.state);
    expect(dirtyKeys(state)).toEqual([]);
    state = receiveSaved(state, stored(SAVED, started.payload));
    expect(state.values.slug).toBe("films-italy");
    expect(dirtyKeys(state)).toEqual([]);

    // Refreshed article first (the save's own revalidation), then the answer.
    state = editField(initDraft(SAVED), "slug", "Films Italy");
    started = start(state);
    state = receiveSaved(started.state, stored(SAVED, started.payload));
    expect(state.conflicts).toEqual([]);
    state = saveSucceeded(state);
    expect(state.values.slug).toBe("films-italy");
    expect(dirtyKeys(state)).toEqual([]);
  });

  it("does not mark newer edits as saved: text typed during the save stays unsaved", () => {
    let state = editField(initDraft(SAVED), "title", "New");
    const started = start(state);
    state = editField(started.state, "title", "Newer");
    state = receiveSaved(state, stored(SAVED, started.payload));
    state = saveSucceeded(state);
    expect(state.values.title).toBe("Newer");
    expect(dirtyKeys(state)).toEqual(["title"]);
  });

  it("does not mark newer edits as saved: a field put back to its old value during the save stays as typed, and unsaved", () => {
    let state = editField(initDraft(SAVED), "title", "New");
    const started = start(state);
    state = editField(started.state, "title", SAVED.title);
    state = saveSucceeded(receiveSaved(state, stored(SAVED, started.payload)));
    expect(state.values.title).toBe(SAVED.title);
    expect(state.base.title).toBe("New");
    expect(dirtyKeys(state)).toEqual(["title"]);
  });

  it("stays unsaved in the moment between the save's answer and the refreshed article", () => {
    let state = editField(initDraft(SAVED), "title", "New");
    const started = start(state);
    state = editField(started.state, "title", SAVED.title);
    state = saveSucceeded(state);
    // The server holds "New" now; the field shows the old text: unsaved, not "Saved".
    expect(dirtyKeys(state)).toEqual(["title"]);
    state = receiveSaved(state, stored(SAVED, started.payload));
    expect(state.values.title).toBe(SAVED.title);
    expect(dirtyKeys(state)).toEqual(["title"]);
  });

  it("a field edited while another field saves is untouched by the answer", () => {
    let state = editField(initDraft(SAVED), "title", "New");
    const started = start(state);
    state = editField(started.state, "metaDescription", "Typed meanwhile.");
    state = saveSucceeded(receiveSaved(state, stored(SAVED, started.payload)));
    expect(dirtyKeys(state)).toEqual(["metaDescription"]);
    expect(state.values.metaDescription).toBe("Typed meanwhile.");
  });

  it("a failed save keeps every edit unsaved", () => {
    const state = editField(initDraft(SAVED), "metaDescription", "Changed.");
    const failed = saveFailed(start(state).state);
    expect(failed.sending).toBeNull();
    expect(dirtyKeys(failed)).toEqual(["metaDescription"]);
  });

  it("the server's answer to its own save is never a conflict", () => {
    const state = editField(initDraft(SAVED), "bodyHtml", "<p>Mine.</p>");
    const started = start(state);
    const received = receiveSaved(started.state, stored(SAVED, started.payload));
    expect(received.conflicts).toEqual([]);
  });
});

describe("the address", () => {
  it("is tidied exactly as the server tidies it", () => {
    for (const input of ["Wedding Films Italy!", "  --über café--  ", "Ünïcödé", "a".repeat(130), "", "already-clean", "Mixed_Case 2026"]) {
      expect(slugFromInput(input)).toBe(normaliseSlug(input) ?? "");
    }
  });

  it("warns when letters will be left out", () => {
    expect(slugDropsLetters("über")).toBe(true);
    expect(slugDropsLetters("città")).toBe(true);
    expect(slugDropsLetters("Wedding Films 2026!")).toBe(false);
  });
});
