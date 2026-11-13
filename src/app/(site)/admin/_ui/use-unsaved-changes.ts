"use client";

import { useEffect } from "react";

/**
 * Warns before unsaved edits are lost.
 *
 * Two ways out are covered: leaving the page entirely (reload, closing the
 * tab, typing an address - the browser's own prompt via beforeunload) and
 * following a link inside the app (an in-app navigation does not fire
 * beforeunload, so a click on any same-origin link is intercepted first and
 * confirmed). Tabs and toggles inside an editor are not links and are not
 * affected - an editor keeps its draft across them on its own.
 */
export const UNSAVED_MESSAGE = "You have unsaved changes. Leave this page and lose them?";

/**
 * The messages of every editor that is dirty right now. Navigation that is
 * not a link click - the Ctrl/Cmd+K page finder calls router.push - asks
 * confirmLeave() first, so it cannot skip the prompt a link would show.
 */
const dirtyEditors = new Map<symbol, string>();

/** True when it is fine to navigate away: nothing unsaved, or the person agreed to lose it. */
export function confirmLeave(): boolean {
  const [message] = dirtyEditors.values();
  return message === undefined || window.confirm(message);
}

export function useUnsavedChanges(dirty: boolean, message: string = UNSAVED_MESSAGE): void {
  useEffect(() => {
    if (!dirty) return;
    const entry = Symbol("unsaved editor");
    dirtyEditors.set(entry, message);

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Required by some browsers to show the prompt; the text itself is not displayed.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // opens elsewhere
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // A link to this same page (a #section) does not leave it.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase on the document: runs before Next's Link handler, so a "Cancel" stops the navigation.
    document.addEventListener("click", onClick, true);
    return () => {
      dirtyEditors.delete(entry);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
