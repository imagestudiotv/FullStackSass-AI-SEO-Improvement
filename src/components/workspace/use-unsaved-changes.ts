"use client";

import { useEffect } from "react";

/**
 * Warns before unsaved edits are lost on a workspace page.
 *
 * Two ways out are covered: leaving the page entirely (reload, closing the
 * tab, typing an address - the browser's own prompt via beforeunload) and
 * following a link inside the app (an in-app navigation does not fire
 * beforeunload, so a click on any same-origin link is intercepted first and
 * confirmed). Tabs and toggles inside a form are not links and are unaffected.
 *
 * The customer app's own copy of the admin hook, so the admin area is not a
 * dependency of customer pages (and is left untouched).
 */
const dirtyForms = new Map<symbol, string>();

/** True when it is fine to navigate away: nothing unsaved, or the person agreed to lose it. */
export function confirmLeave(): boolean {
  const [message] = dirtyForms.values();
  return message === undefined || window.confirm(message);
}

export function useUnsavedChanges(dirty: boolean, message: string): void {
  useEffect(() => {
    if (!dirty) return;
    const entry = Symbol("unsaved form");
    dirtyForms.set(entry, message);

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
      // A link to a section of this same page does not leave it.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase on the document: runs before Next's Link handler, so "Cancel" stops the navigation.
    document.addEventListener("click", onClick, true);
    return () => {
      dirtyForms.delete(entry);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
