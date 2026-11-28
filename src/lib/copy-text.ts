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
  // Inside the open drawer, dialog or menu when the click came from one: their focus trap
  // (Radix) pulls the focus straight back from anything outside, and the copy finds nothing
  // selected. The Opportunities page posts and copies from its review drawer and row menus.
  const host = focused?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"]') ?? document.body;
  host.append(area);
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

/**
 * Copies text only once `approved` says yes, for a click whose copy must wait
 * for the server (the Social page's one-click post: nothing reaches the
 * clipboard before lib/social/actions.ts has checked the text).
 *
 * The copy is asked for in the click itself, with the text still to come
 * (a ClipboardItem holding a promise): the browser checks the focus and the
 * click when the copy is asked for, before the new tab takes them, and writes
 * the text when the promise gives it. A refusal gives nothing, and nothing is
 * written. A browser without it copies by selection once approved, which can
 * fail once the new tab has the focus: the page then says to use Copy.
 */
export function copyTextWhen(text: string, approved: Promise<boolean>): Promise<boolean> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const blob = approved.then((ok) => (ok ? new Blob([text], { type: "text/plain" }) : Promise.reject(new Error("not approved"))));
    // Handled here too: a refusal must not surface as an unhandled rejection.
    blob.catch(() => {});
    try {
      return navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]).then(
        () => true,
        () => false,
      );
    } catch {
      // A ClipboardItem that does not take a promise: the copy below.
    }
  }
  return approved.then((ok) => (ok ? copyTextNow(text) : false));
}
