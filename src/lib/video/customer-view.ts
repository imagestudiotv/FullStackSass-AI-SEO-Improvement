import { readDestinations } from "./destinations";
import { isVideoPlatform, type DestinationState, type VideoPlatform } from "./formats";

/**
 * A video as its customer sees it (Daniel, 2026-11-24: "remove all this
 * failed part for clients view, they should don't know about them").
 *
 * video_ideas keeps the truth for the team: status "failed", the error, each
 * destination's refusal (Admin -> Social posting reads them). The customer:
 *  - a make that failed (no files; its credit was returned): the idea is
 *    back in Today's ideas;
 *  - a publish that failed (the files are there): Ready to publish, by hand
 *    or again;
 *  - a destination that failed or was left out is not shown; one that posted
 *    is. Nothing reads as posted when it is not.
 *
 * Pure view logic, so rows that failed before this change are covered too.
 * No server imports.
 */

type Made = { status: string; videoUrl: string | null; slideUrls: string[] | null };

export const hasFiles = (row: Pick<Made, "videoUrl" | "slideUrls">) => Boolean(row.videoUrl || (row.slideUrls && row.slideUrls.length > 0));

/** A make that failed: the idea waits in Today's ideas again. */
export const isReturned = (row: Made) => row.status === "failed" && !hasFiles(row);

/** The status the customer is shown. */
export function customerStatus(row: Made): string {
  if (row.status !== "failed") return row.status;
  return hasFiles(row) ? "ready" : "new";
}

const SHOWN = ["posted", "posting", "scheduled"];

/** The destinations the customer is shown: where it is, is on its way, or will go - never a refusal or its words. */
export function customerDestinations(raw: unknown): Partial<Record<VideoPlatform, DestinationState>> {
  const out: Partial<Record<VideoPlatform, DestinationState>> = {};
  for (const [platform, state] of Object.entries(readDestinations(raw))) {
    if (isVideoPlatform(platform) && state && SHOWN.includes(state.status)) out[platform] = { ...state, error: null };
  }
  return out;
}

/** The one stored note that asks the customer for something: a review RepGet holds automatic posting for. */
const CUSTOMER_NOTES = ["review_required"];

export function customerNote(error: string | null): string | null {
  return (error ?? "").split(" · ").find((part) => CUSTOMER_NOTES.includes(part)) ?? null;
}
