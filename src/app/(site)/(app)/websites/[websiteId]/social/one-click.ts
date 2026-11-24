import { copyTextNow } from "@/lib/copy-text";
import type { SocialResult } from "@/lib/social/actions";
import { isSocialPlatform } from "@/lib/social/platforms";
import { postTarget, postText, type PostEdit } from "@/lib/social/post-target";

import type { SuggestionView } from "./opportunities";

/**
 * The one-click post, without React: the click copies the text and opens the
 * platform's own address at once, and RepGet records it behind it.
 *
 * Nothing is waited for before the tab opens (client, 2026-11-24: "Open on
 * Reddit" opened a tab that stayed blank). It used to open an empty tab and
 * send it to the address the server answered with; any answer that came late,
 * or never, left that tab empty. The address is the one the server works out
 * too (lib/social/post-target.ts). When the server then refuses, nothing is
 * charged or moved, RepGet says why, and the opened tab stays open.
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
  done: (outcome: { url: string; opened: boolean; copied: boolean; filled: boolean }) => void;
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

const within = (promise: Promise<boolean>, ms: number) =>
  Promise.race([promise.catch(() => false), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

/** Must be called in the click itself: browsers allow neither the copy nor the new tab once it has passed. */
export function oneClickPost({ row, text, edit, record }: OneClickPost, report: OneClickReport): void {
  if (!isSocialPlatform(row.platform)) return report.refused(null);
  const platform = row.platform;
  // The server's own rule: what it would surely refuse does not open a tab first.
  const checked = postText(platform, row.title, edit);
  if (!checked.ok) return report.refused(checked);
  const { url, filled } = postTarget({ platform, threadUrl: row.threadUrl, link: row.link, imageUrl: row.imageUrl }, checked);
  if (!url.startsWith("https://")) return report.refused(null);

  // The copy goes first, while this page still has the focus the new tab is about to take (lib/copy-text.ts).
  const copying = copyTextNow(text);
  const opened = openTab(url);
  const slow = setTimeout(report.slow, RECORD_WAIT_MS);
  void (async () => {
    const result = await record().catch(() => null);
    clearTimeout(slow);
    if (!result?.ok) return report.refused(result);
    report.done({ url, opened, copied: await within(copying, COPY_WAIT_MS), filled });
  })();
}
