import { sameHtml } from "@/lib/articles/use-draft";

/**
 * The article workspace's working copy: every field a Save sends (title,
 * meta description, address and text), what the server last saved, and
 * what a save in flight carried.
 *
 * A pure model so the rules that decide what counts as "unsaved" can be
 * tested without a browser, and so they read in one place:
 *
 *  - A field is UNSAVED when its value would save as something other than
 *    what is stored - compared the way the server stores it (trimmed,
 *    capped, the address tidied, HTML sanitised), so a trailing space or
 *    the editor's own re-serialisation is not an edit.
 *  - Background refreshes (polling while an article is written, a refresh
 *    after an action) never overwrite a field the person has edited. A field
 *    nobody touched follows the server, so a finished rewrite appears.
 *  - A save's answer only settles what that save carried. Anything typed
 *    while it was in flight stays unsaved - including putting a field back
 *    to its old value, which a value-equality check used to mistake for
 *    "untouched" and replace with the newly saved text.
 *  - A field edited here that ALSO changed on the server meanwhile (a rewrite
 *    finished, a teammate saved) is a conflict the page names, rather than
 *    one side silently winning on the next Save.
 */

export type FieldKey = "title" | "metaDescription" | "slug" | "bodyHtml";

export const FIELD_KEYS: readonly FieldKey[] = ["title", "metaDescription", "slug", "bodyHtml"];

export type ArticleFields = Record<FieldKey, string>;

/** Server limits (lib/articles/actions.ts updateArticle, lib/articles/generate.ts normaliseSlug). */
export const TITLE_MAX = 200;
export const META_MAX = 300;
export const SLUG_MAX = 120;
/** Roughly what a search result shows of a meta description. Advice, not a limit. */
export const META_SHOWN = 155;

/**
 * The address a typed slug is saved as - normaliseSlug's rule, repeated here
 * because that module is server code (it imports the AI client). A test
 * compares the two so they cannot drift (draft-state.test.ts).
 */
export function slugFromInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

/**
 * True when a typed slug has letters the address will leave out - accented
 * letters and other non-ASCII characters are dropped, not transliterated
 * ("über" saves as "ber"), and the page says so before it happens.
 */
export function slugDropsLetters(input: string): boolean {
  // Any letter left once the plain a-z ones are taken out.
  return /\p{L}/u.test(input.replace(/[a-z]/gi, ""));
}

/** A value as the server would store it (text fields only; HTML is compared with sameHtml). */
export function savedForm(key: Exclude<FieldKey, "bodyHtml">, value: string): string {
  switch (key) {
    case "title":
      return value.trim().slice(0, TITLE_MAX);
    case "metaDescription":
      return value.trim().slice(0, META_MAX);
    case "slug":
      return slugFromInput(value);
  }
}

/** True when saving `value` would store exactly `saved`. */
export function sameAsSaved(key: FieldKey, value: string, saved: string): boolean {
  if (value === saved) return true;
  if (key === "bodyHtml") return sameHtml(value, saved);
  return savedForm(key, value) === saved;
}

/** True when two typed values would be stored as the same thing. */
function sameOnceSaved(key: FieldKey, a: string, b: string): boolean {
  if (a === b) return true;
  if (key === "bodyHtml") return sameHtml(a, b);
  return savedForm(key, a) === savedForm(key, b);
}

export type DraftState = {
  /** What the fields show. */
  values: ArticleFields;
  /** Edited by the person since this field last followed the server. */
  touched: Record<FieldKey, boolean>;
  /** The saved article as last received from the server. */
  base: ArticleFields;
  /** The values a save in flight carried, or null. */
  sending: Partial<ArticleFields> | null;
  /** Values a confirmed save carried whose saved form has not arrived yet. */
  awaiting: Partial<ArticleFields>;
  /** Fields edited here that also changed on the server meanwhile. */
  conflicts: FieldKey[];
};

const UNTOUCHED: Record<FieldKey, boolean> = { title: false, metaDescription: false, slug: false, bodyHtml: false };

export function initDraft(saved: ArticleFields): DraftState {
  return { values: { ...saved }, touched: { ...UNTOUCHED }, base: { ...saved }, sending: null, awaiting: {}, conflicts: [] };
}

function without<T>(list: readonly T[], item: T): T[] {
  return list.filter((entry) => entry !== item);
}

function omit(record: Partial<ArticleFields>, key: FieldKey): Partial<ArticleFields> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * A keystroke (or the editor's change event). Typing back to exactly what the
 * server holds is not an edit - and while a save of this field is on its way,
 * what the server holds is what that save sent, so putting the old text back
 * meanwhile IS an edit (the save is about to replace the old text).
 */
export function editField(state: DraftState, key: FieldKey, value: string): DraftState {
  const expected = state.sending?.[key] ?? state.awaiting[key] ?? state.base[key];
  const touched = value !== expected;
  return {
    ...state,
    values: { ...state.values, [key]: value },
    touched: { ...state.touched, [key]: touched },
    conflicts: touched ? state.conflicts : without(state.conflicts, key),
  };
}

/** True when the server's saved article differs from the one this state last saw. */
export function hasNewSaved(state: DraftState, saved: ArticleFields): boolean {
  return FIELD_KEYS.some((key) => saved[key] !== state.base[key]);
}

/**
 * The server's saved article arrived (a refresh, polling, or a save's own
 * revalidation). Untouched fields follow it; touched ones are kept, and are
 * flagged as a conflict when the change was not this page's own save.
 */
export function receiveSaved(state: DraftState, saved: ArticleFields): DraftState {
  if (!hasNewSaved(state, saved)) return state;
  const values = { ...state.values };
  let awaiting = state.awaiting;
  let conflicts = state.conflicts;
  for (const key of FIELD_KEYS) {
    if (saved[key] === state.base[key]) continue;
    const sentNow = state.sending?.[key];
    const sentEarlier = state.awaiting[key];
    const own =
      (sentNow !== undefined && sameAsSaved(key, sentNow, saved[key])) ||
      (sentEarlier !== undefined && sameAsSaved(key, sentEarlier, saved[key]));
    awaiting = omit(awaiting, key);
    if (!state.touched[key]) {
      /*
        The text keeps the editor's own markup when it saves to the same
        thing: replacing it would reset the caret in the middle of a word.
      */
      values[key] = key === "bodyHtml" && sameHtml(values.bodyHtml, saved.bodyHtml) ? values.bodyHtml : saved[key];
    } else if (!own && !sameAsSaved(key, values[key], saved[key]) && !conflicts.includes(key)) {
      conflicts = [...conflicts, key];
    }
  }
  return { ...state, values, awaiting, conflicts, base: { ...saved } };
}

/**
 * Fields whose value would save as something other than what is stored -
 * where "stored" is what a confirmed save sent, until the refreshed article
 * arrives to show it.
 */
export function dirtyKeys(state: DraftState): FieldKey[] {
  return FIELD_KEYS.filter((key) => {
    const confirmed = state.awaiting[key];
    if (confirmed !== undefined) return !sameOnceSaved(key, state.values[key], confirmed);
    return !sameAsSaved(key, state.values[key], state.base[key]);
  });
}

/** Starts a save of the unsaved fields only, so a field nobody changed is never overwritten. */
export function beginSave(state: DraftState): { state: DraftState; payload: Partial<ArticleFields> } | null {
  const keys = dirtyKeys(state);
  if (keys.length === 0) return null;
  const payload: Partial<ArticleFields> = {};
  for (const key of keys) payload[key] = state.values[key];
  return { state: { ...state, sending: payload }, payload };
}

/**
 * The server confirmed the save in flight. Only fields still holding what
 * was sent become saved; anything typed meanwhile stays unsaved.
 */
export function saveSucceeded(state: DraftState): DraftState {
  const sent = state.sending ?? {};
  const values = { ...state.values };
  const touched = { ...state.touched };
  let awaiting = state.awaiting;
  let conflicts = state.conflicts;
  for (const key of FIELD_KEYS) {
    const value = sent[key];
    if (value === undefined) continue;
    const reflected = sameAsSaved(key, value, state.base[key]);
    // Until the refreshed article arrives, what this save sent is what is stored.
    if (!reflected) awaiting = { ...awaiting, [key]: value };
    // Typed on since it was sent: still the person's, still unsaved.
    if (values[key] !== value) continue;
    touched[key] = false;
    conflicts = without(conflicts, key);
    // Already reflected: show the stored form (the tidied address, the trimmed title), except for the text.
    if (reflected && key !== "bodyHtml") values[key] = state.base[key];
  }
  return { ...state, values, touched, awaiting, conflicts, sending: null };
}

export function saveFailed(state: DraftState): DraftState {
  return { ...state, sending: null };
}

/** Puts fields back to what is saved (all of them by default). */
export function discardFields(state: DraftState, keys: readonly FieldKey[] = FIELD_KEYS): DraftState {
  const values = { ...state.values };
  const touched = { ...state.touched };
  let awaiting = state.awaiting;
  for (const key of keys) {
    values[key] = state.base[key];
    touched[key] = false;
    awaiting = omit(awaiting, key);
  }
  return { ...state, values, touched, awaiting, conflicts: state.conflicts.filter((key) => !keys.includes(key)) };
}

/** Keeps the local version of conflicting fields; the next Save replaces the server's. */
export function keepLocal(state: DraftState): DraftState {
  return { ...state, conflicts: [] };
}
