"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the page from the server every `everyMs` while `active`, for at
 * most `forMs` - for something that settles in minutes to an hour (the
 * WordPress plugin collecting an article), where the shared 3-second
 * refresh (components/refresh-while.ts) would be wasteful. Skipped while the
 * tab is hidden. Reading only: a refresh starts nothing.
 */
export function useSlowRefresh(active: boolean, everyMs = 20_000, forMs = 15 * 60_000): void {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > forMs) {
        window.clearInterval(timer);
        return;
      }
      if (document.visibilityState !== "hidden") router.refresh();
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [active, everyMs, forMs, router]);
}
