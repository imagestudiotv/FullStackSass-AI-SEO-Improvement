import type { ProviderErrorKind } from "@/lib/publishing/provider";

/**
 * What the Publishing panel can honestly say and offer, derived from facts
 * the server read (page.tsx / article-data.ts) and from what this page just
 * asked for.
 *
 * Pure, so the rules are testable and stated once:
 *  - Publishing sends the SAVED article. With unsaved edits on screen the
 *    buttons wait for a Save rather than send an older revision while the
 *    screen shows a newer one.
 *  - A press the server would refuse, or that the publish job would hold
 *    without a trace (a freeze, the RepGet team's review, a delivery already
 *    in progress, the exact version already on the site), is not offered as
 *    if it would work: the button says why it waits.
 *  - "Queued" is not "published": after a press, the panel waits for the
 *    job's real outcome (a new dispatch or log) and says so.
 */

export type Destination =
  | { kind: "none" }
  /** A direct CMS connection: the one the publish job uses (newest verified). */
  | { kind: "direct"; name: string; provider: string; site: string | null }
  /** Only the WordPress plugin, which pulls articles. */
  | { kind: "plugin" };

/** The managed Partner Network review gate (lib/articles/review.ts). */
export type ReviewState = "none" | "pending" | "changed" | "approved";

/** The most recent recorded result of sending this article. */
export type LastOutcome =
  | { kind: "none" }
  | { kind: "live" | "draft" | "scheduled" | "delivered" | "pluginUnconfirmed"; when: string }
  | { kind: "failed"; when: string; errorKind: ProviderErrorKind };

/** Read on the server; plain data, dates already formatted. */
export type PublishFacts = {
  destination: Destination;
  review: ReviewState;
  /** platform_controls.publication_freeze: nothing is sent while on. */
  frozen: boolean;
  /** The latest direct send got no answer (lib/publishing/dispatch.ts). */
  uncertain: boolean;
  /** A dispatch is in flight right now (claimed within the in-flight timeout). */
  delivering: boolean;
  /** The CMS reported the post live, or the article is published. */
  liveOnSite: boolean;
  /** The saved revision already reached the site with this status (the claim's already_sent rule). */
  alreadySent: { publish: boolean; draft: boolean };
  lastOutcome: LastOutcome;
  /** Identities of the newest dispatch and log, to notice a press's result arriving. */
  latestDispatchId: string | null;
  latestLogId: string | null;
  /** The planned day, formatted; null when the article has no planned date. */
  planned: string | null;
  plannedInFuture: boolean;
  /** The website's automatic publishing setting. */
  autoPublish: "off" | "live" | "draft";
};

/** A direct-publish press this page made and has not seen the result of yet. */
export type PendingPress = {
  status: "publish" | "draft";
  /** Date.now() when the server accepted it. */
  at: number;
  /** The newest dispatch and log ids when it was pressed. */
  dispatchId: string | null;
  logId: string | null;
};

/** How long to keep checking for a press's result before saying it is taking longer. */
export const PRESS_WATCH_MS = 90_000;

/** True while nothing newer than the press has been recorded. */
export function awaitingResult(press: PendingPress | null, facts: PublishFacts): boolean {
  if (!press) return false;
  return facts.latestDispatchId === press.dispatchId && facts.latestLogId === press.logId && !facts.delivering;
}

export type Blocker = "working" | "frozen" | "review" | "delivering" | "awaiting" | "unsaved";

export type PublishPlan =
  /** A viewer, or nothing written yet: nothing to press. */
  | { mode: "hidden" }
  | { mode: "connect" }
  | { mode: "pluginWaiting"; as: "publish" | "draft" }
  /** Created by the plugin, which cannot update a post it created. */
  | { mode: "pluginPublished" }
  | {
      mode: "actions";
      /** Why both buttons wait, or null. */
      blocked: Blocker | null;
      publishLabel: "publish" | "update";
      /** Per button: the exact version is already there with this status. */
      publishAlreadySent: boolean;
      draftAlreadySent: boolean;
      /** Sending a live post as a draft can take it offline: ask first. */
      confirmDraft: boolean;
    };

export function planPublishing(input: {
  canEdit: boolean;
  hasBody: boolean;
  working: boolean;
  dirty: boolean;
  /** A press this page made has no recorded result yet (awaitingResult). */
  awaiting: boolean;
  /**
   * PRESS_WATCH_MS have passed since that press. The job can hold a press
   * without recording anything (an unresolved earlier send, a freeze, a job
   * that never ran), so from then on the wait is information only and both
   * buttons come back; the server's claim still refuses a duplicate post.
   */
  pressExpired: boolean;
  publishRequested: string | null;
  publishedUrl: string | null;
  facts: PublishFacts;
}): PublishPlan {
  const { facts } = input;
  if (!input.canEdit || !input.hasBody) return { mode: "hidden" };
  if (facts.destination.kind === "none") return { mode: "connect" };
  if (facts.destination.kind === "plugin") {
    if (input.publishRequested === "publish" || input.publishRequested === "draft") {
      return { mode: "pluginWaiting", as: input.publishRequested };
    }
    // The plugin's feed offers only articles it has not created yet (lib/plugin/due.ts).
    if (input.publishedUrl) return { mode: "pluginPublished" };
  }

  let blocked: Blocker | null = null;
  if (input.working) blocked = "working";
  else if (facts.frozen) blocked = "frozen";
  else if (facts.review === "pending" || facts.review === "changed") blocked = "review";
  else if (facts.delivering) blocked = "delivering";
  else if (input.awaiting && !input.pressExpired) blocked = "awaiting";
  else if (input.dirty) blocked = "unsaved";

  return {
    mode: "actions",
    blocked,
    publishLabel: facts.liveOnSite ? "update" : "publish",
    publishAlreadySent: facts.alreadySent.publish,
    draftAlreadySent: facts.alreadySent.draft,
    confirmDraft: facts.liveOnSite,
  };
}

/**
 * How often the page should re-read the server, if at all. "fast" follows
 * work that finishes in seconds to minutes; "slow" the WordPress plugin,
 * which checks in about hourly. Nothing is polled once the state settles.
 */
export function refreshNeed(input: {
  working: boolean;
  delivering: boolean;
  watchingPress: boolean;
  pluginWaiting: boolean;
}): "fast" | "slow" | null {
  if (input.working || input.delivering || input.watchingPress) return "fast";
  if (input.pluginWaiting) return "slow";
  return null;
}
