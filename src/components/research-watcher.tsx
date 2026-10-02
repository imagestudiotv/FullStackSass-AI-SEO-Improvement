"use client";

import { useRefreshWhile } from "@/components/refresh-while";

/**
 * Follows the selected website's keyword research from the app layout, so
 * every screen - the floating setup panel, /setup, the sidebar's "Set up n/9"
 * - ticks the content-plan step when the run ends. Only the content page used
 * to follow it; new customers are sent on to /setup the moment research is
 * queued, and saw the step done only after a reload.
 *
 * The layout renders this only while research is in flight.
 */
export function ResearchWatcher() {
  useRefreshWhile(true);
  return null;
}
