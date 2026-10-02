"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the page from the server every few seconds while `active` -
 * to follow background work (keyword research) to its end without a manual
 * reload (client, 2026-10-02: "it was marked as completed only once I
 * refreshed the page").
 *
 * ONE timer for the whole page, however many components ask: the app layout
 * follows a run (ResearchWatcher) and so does the content page, and two
 * intervals would refresh twice as often for nothing. Skipped while the tab is
 * hidden; the next tick after it returns catches up.
 */

const INTERVAL_MS = 3000;

let followers = 0;
let timer: number | null = null;
let refresh: (() => void) | null = null;

export function useRefreshWhile(active: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    refresh = () => router.refresh();
    followers += 1;
    if (timer === null) {
      timer = window.setInterval(() => {
        if (document.visibilityState !== "hidden") refresh?.();
      }, INTERVAL_MS);
    }
    return () => {
      followers -= 1;
      if (followers === 0 && timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
  }, [active, router]);
}
