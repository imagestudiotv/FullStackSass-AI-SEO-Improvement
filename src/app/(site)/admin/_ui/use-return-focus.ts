"use client";

import { useRef, type RefObject } from "react";

/**
 * Focus handling for a Radix dialog opened from state rather than a Trigger.
 *
 * Radix returns focus to its Trigger on close; without one (the page finder
 * opens from Ctrl+K, the drawer and several confirmations from a button or a
 * menu item that sets state) focus fell to <body>, and a keyboard user was
 * thrown back to the top of the document. Spread the result on the dialog's
 * Content: it remembers what had focus when the dialog opened and puts it
 * back. `fallback` is for dialogs opened from a menu item, which is gone by
 * then - pass the menu's trigger button.
 */
export function useReturnFocus(fallback?: RefObject<HTMLElement | null>) {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const remembered = previous.current;
      previous.current = null;
      const target = remembered?.isConnected && remembered !== document.body ? remembered : fallback?.current;
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
