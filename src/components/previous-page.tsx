"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The last public page this tab showed, for the 404 report
 * (components/not-found-panel.tsx).
 *
 * Needed because a link followed inside the site does not load a new
 * document, so document.referrer still names whatever page opened the tab -
 * Google, say - instead of the page holding the broken link.
 */
let lastPath: string | null = null;

export function lastShownPath(): string | null {
  return lastPath;
}

/**
 * Records each page as it is shown. Mounted once, AFTER the page in the
 * public site's frame (components/marketing-shell.tsx): React runs a page's
 * effects before a later sibling's, so when a 404 page reports itself this
 * still holds the page the visitor came from.
 */
export function PreviousPageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    lastPath = pathname;
  }, [pathname]);
  return null;
}
