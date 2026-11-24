import type { Destination } from "./publish-state";

/**
 * When the "connect your website" popup is offered on an article, and what
 * "Not now" remembers. Pure, beside the window it belongs to.
 */

/** How long "Not now" holds for one website: long enough not to nag, short enough to be asked again. */
export const CONNECT_POPUP_QUIET_MS = 7 * 24 * 60 * 60 * 1000;

const key = (websiteId: string) => `repget.connect-popup.${websiteId}`;

/**
 * Whether this visit may be offered the popup: somebody who may connect the
 * website (never a viewer), a website with nowhere to publish, and an article
 * that can be read - not one still being written, or whose writing failed.
 */
export function offersConnect(input: { canEdit: boolean; destination: Destination; status: string; hasBody: boolean }): boolean {
  return input.canEdit && input.destination.kind === "none" && input.hasBody && !["queued", "generating", "failed"].includes(input.status);
}

/** "Not now" was pressed on this website lately, in this browser. */
export function connectPopupDismissed(websiteId: string, now: number = Date.now()): boolean {
  try {
    const at = Number(window.localStorage.getItem(key(websiteId)));
    return at > 0 && now - at < CONNECT_POPUP_QUIET_MS;
  } catch {
    // No storage (a private window, blocked cookies): the popup closes for this visit only.
    return false;
  }
}

export function dismissConnectPopup(websiteId: string, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(key(websiteId), String(now));
  } catch {
    // Closed for this visit only.
  }
}
