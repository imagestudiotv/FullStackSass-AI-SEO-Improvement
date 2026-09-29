import { useState } from "react";

import { sanitizeHtml } from "@/lib/articles/sanitize";

/**
 * The article editors' working copy of one field, and what Preview shows.
 *
 * Preview used to render the SAVED article, so a change typed on the Edit tab
 * did not appear there until it was saved - pressing Preview after editing
 * looked like the button did nothing. Preview now shows this working copy.
 *
 * The working copy starts from the saved value and follows it when it changes
 * underneath (a rewrite finishing, a save coming back) as long as nobody has
 * edited the field meanwhile; unsaved edits are never overwritten. Without
 * this, a finished rewrite stayed invisible on both tabs until a reload.
 *
 * `same` decides "not edited": for HTML, sameHtml, since the editor
 * re-serialises markup without changing it.
 */
export function useDraftField(
  saved: string,
  same: (a: string, b: string) => boolean = Object.is,
): [string, (value: string) => void] {
  const [value, setValue] = useState(saved);
  const [base, setBase] = useState(saved);
  // Adjusting state while rendering, React's pattern for following a prop:
  // it re-renders at once, before anything stale is shown.
  if (saved !== base) {
    setBase(saved);
    if (same(value, base)) setValue(saved);
  }
  return [value, setValue];
}

/**
 * Article HTML exactly as a save would keep it, minus the site-specific
 * internal-link attributes: what Preview renders. Sanitised because the
 * editor's "Edit HTML" box takes anything, and Preview must not run a pasted
 * script or handler before the save would have removed it.
 */
export function previewHtml(html: string): string {
  return sanitizeHtml(html);
}

/** True when two article bodies are the same once saved (markup order aside). */
export function sameHtml(a: string, b: string): boolean {
  return a === b || previewHtml(a) === previewHtml(b);
}
