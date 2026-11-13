/**
 * A meta description short enough to be shown whole: at most `max`
 * characters (155 by default).
 *
 * For text written in Admin -> Blog, where nothing caps it: a category's
 * blurb is also the intro on its page (17 of them were 192-200 characters),
 * and a post's description is also its card summary (12 were 161-166). Ahrefs
 * reports those as "Meta description too long" and search results cut them
 * mid-word (live audit, 2026-11-13). The text on the page stays whole; only
 * the <meta name="description"> is shortened.
 *
 * Text that fits is returned as written. Otherwise it ends at the last full
 * sentence that leaves at least 100 characters, or else at the last whole
 * word, with an ellipsis.
 */
export function metaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const head = clean.slice(0, max + 1);
  const sentenceEnd = Math.max(...[". ", "! ", "? "].map((end) => head.lastIndexOf(end)));
  if (sentenceEnd + 1 >= 100) return clean.slice(0, sentenceEnd + 1);

  const room = clean.slice(0, max);
  const wordEnd = room.lastIndexOf(" ");
  const cut = wordEnd >= 60 ? room.slice(0, wordEnd) : room.slice(0, max - 1);
  return `${cut.replace(/[\s,;:–—-]+$/, "")}…`;
}

/**
 * A listing's description from page 2 on: the text, shortened to leave room,
 * then " — Page N." - so each page's description stays different from the
 * others' and within `max`.
 */
export function pagedDescription(text: string, suffix: string, max = 155): string {
  const room = max - suffix.length - 1;
  return `${metaDescription(text, room).replace(/[.…]$/, "")}${suffix}.`;
}
