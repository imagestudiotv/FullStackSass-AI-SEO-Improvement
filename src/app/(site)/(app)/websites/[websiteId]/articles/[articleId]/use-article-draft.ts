"use client";

import { useState } from "react";

import {
  beginSave,
  dirtyKeys,
  discardFields,
  editField,
  hasNewSaved,
  initDraft,
  keepLocal,
  receiveSaved,
  saveFailed,
  saveSucceeded,
  type ArticleFields,
  type FieldKey,
} from "./draft-state";

/**
 * The article page's working copy (see draft-state.ts for the rules).
 *
 * The saved article arrives as props on every server render - a refresh,
 * polling while it is written, a save's own revalidation - and is folded in
 * while rendering (React's pattern for following a prop), so nothing stale
 * is ever painted and nobody's edit is overwritten.
 */
export function useArticleDraft(saved: ArticleFields) {
  const [state, setState] = useState(() => initDraft(saved));

  let current = state;
  if (hasNewSaved(state, saved)) {
    current = receiveSaved(state, saved);
    setState(current);
  }

  const dirty = dirtyKeys(current);

  return {
    values: current.values,
    dirty,
    conflicts: current.conflicts,
    saving: current.sending !== null,
    setField(key: FieldKey, value: string) {
      setState((previous) => editField(previous, key, value));
    },
    /** The fields to send, or null when nothing is unsaved. Marks them as in flight. */
    startSave(): Partial<ArticleFields> | null {
      const started = beginSave(current);
      if (!started) return null;
      setState((previous) => ({ ...previous, sending: started.payload }));
      return started.payload;
    },
    saveSucceeded() {
      setState((previous) => saveSucceeded(previous));
    },
    saveFailed() {
      setState((previous) => saveFailed(previous));
    },
    discard(keys?: readonly FieldKey[]) {
      setState((previous) => discardFields(previous, keys));
    },
    keepMine() {
      setState((previous) => keepLocal(previous));
    },
  };
}
