import { copyTextWhen } from "@/lib/copy-text";
import type { SocialResult } from "@/lib/social/actions";
import { isSocialPlatform } from "@/lib/social/platforms";
import { postTarget, postText, type PostEdit } from "@/lib/social/post-target";

import type { SuggestionView } from "./opportunities";

/**
 * The one-click post, without React. THE SERVER CHECKS FIRST (2026-11-28):
 * nothing is copied and no platform page opens before RepGet has checked the
 * text and recorded the post (lib/social/actions.ts postSocialSuggestion:
 * the warm-up, a reply naming the business where it may not, promotional
 * words, the credit). Copied and opened first, a refused reply could still be
 * pasted on Reddit, Bluesky or Quora.
 *
 * So the click opens a blank tab at once (a tab opened after the answer is
 * blocked as a popup) and asks for the copy (written only when the server
 * agrees, lib/copy-text.ts copyTextWhen); the answer sends the tab to the
 * platform, or closes it and the page says why. The address is worked out
 * here, by the same rule as the server (lib/social/post-target.ts), so it
 * never waits for the server to send one (client, 2026-11-24: a tab sent to
 * the answer's address stayed blank when the answer came late). One with no
 * answer at all is closed after RECORD_WAIT_MS; a later "yes" offers the link.
 */

/** The button is free again after this long without an answer; a later answer is still reported. */
export const RECORD_WAIT_MS = 15_000;
/** A clipboard that never answers (a permission left open) is a copy that failed. */
export const COPY_WAIT_MS = 2_000;

type Refusal = Extract<SocialResult<unknown>, { ok: false }>;

export type OneClickPost = {
  row: Pick<SuggestionView, "platform" | "threadUrl" | "title" | "link" | "imageUrl">;
  /** What is copied: a title, where there is one, on top of the body. */
  text: string;
  edit: PostEdit;
  record: () => Promise<SocialResult<unknown>>;
};

export type OneClickReport = {
  /** Why it was not recorded; null when no readable answer came. */
  refused: (result: Refusal | null) => void;
  /** No answer yet: it may or may not have been recorded. */
  slow: () => void;
  /** `late`: the answer came after RECORD_WAIT_MS, when the blank tab had been closed (opened is false). */
  done: (outcome: { url: string; opened: boolean; copied: boolean; filled: boolean; late: boolean }) => void;
};

/**
 * Opens an address in a new tab, and says whether the browser allowed it.
 *
 * Not window.open's "noopener": with it the call returns null whether the tab
 * opened or was blocked, and "your browser blocked the new tab" could not be
 * said truthfully. Cutting the link to this page here is as safe: it happens
 * in the same task as the opening, before anything of the new page runs.
 */
export function openTab(url: string): boolean {
  const tab = window.open(url, "_blank");
  if (!tab) return false;
  try {
    tab.opener = null;
  } catch {
    // Already out of this page's reach, which is what it is for.
  }
  return true;
}

/** A blank tab, opened in the click and cut off from this page; sent to the platform later (sendTab). */
function openBlankTab(): Window | null {
  const tab = window.open("", "_blank");
  if (!tab) return null;
  try {
    // Before the platform's page is in it: it never reaches back into RepGet.
    tab.opener = null;
  } catch {
    // Already out of this page's reach.
  }
  return tab;
}

function sendTab(tab: Window, url: string): boolean {
  try {
    if (tab.closed) return false;
    // Replaced, so Back does not lead to the blank page.
    tab.location.replace(url);
    return true;
  } catch {
    return false;
  }
}

function closeTab(tab: Window | null) {
  try {
    tab?.close();
  } catch {
    // Nothing to close.
  }
}

const within = (promise: Promise<boolean>, ms: number) =>
  Promise.race([promise.catch(() => false), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

/** Must be called in the click itself: browsers allow neither the copy nor the new tab once it has passed. */
export function oneClickPost({ row, text, edit, record }: OneClickPost, report: OneClickReport): void {
  if (!isSocialPlatform(row.platform)) return report.refused(null);
  const platform = row.platform;
  // The server's own rule: what it would surely refuse opens no tab at all.
  const checked = postText(platform, row.title, edit);
  if (!checked.ok) return report.refused(checked);
  const { url, filled } = postTarget({ platform, threadUrl: row.threadUrl, link: row.link, imageUrl: row.imageUrl }, checked);
  if (!url.startsWith("https://")) return report.refused(null);

  let approve: (ok: boolean) => void = () => {};
  const approved = new Promise<boolean>((resolve) => (approve = resolve));
  // Asked for first, while this page still has the focus the new tab is about to take; written only on a yes.
  const copying = copyTextWhen(text, approved);
  let tab = openBlankTab();
  let late = false;
  const slow = setTimeout(() => {
    // A tab left blank is worse than none: closed, and a later yes offers the link instead.
    late = true;
    closeTab(tab);
    tab = null;
    report.slow();
  }, RECORD_WAIT_MS);
  void (async () => {
    const result = await record().catch(() => null);
    clearTimeout(slow);
    if (!result?.ok) {
      approve(false);
      closeTab(tab);
      return report.refused(result);
    }
    approve(true);
    const opened = tab ? sendTab(tab, url) : false;
    report.done({ url, opened, copied: await within(copying, COPY_WAIT_MS), filled, late });
  })();
}
