/**
 * Copies text to the clipboard at once, inside the click, and says whether it
 * worked.
 *
 * For a click that also opens a new tab (the Social page's one-click post):
 * navigator.clipboard.writeText checks a moment later that the page still has
 * the focus, and by then the new tab has taken it, so the copy is refused
 * ("Document is not focused") and Quora opens with nothing to paste. The old
 * execCommand copy finishes before the tab opens. The asynchronous clipboard
 * is the fallback for browsers that no longer allow execCommand.
 */
export function copyTextNow(text: string): Promise<boolean> {
  if (copyBySelection(text)) return Promise.resolve(true);
  if (!navigator.clipboard?.writeText) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

function copyBySelection(text: string): boolean {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  Object.assign(area.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
  document.body.append(area);
  area.select();
  // iOS selects nothing with select() alone.
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  focused?.focus({ preventScroll: true });
  return copied;
}
