import { GPT_SCRIPT_URL } from "@/lib/earn/rewarded-ads-config";

/**
 * Google Publisher Tag's rewarded format, the way Google's own sample does it
 * (developers.google.com/publisher-tag/samples/display-rewarded-ad): one
 * out-of-page REWARDED slot; `rewardedSlotReady` hands over
 * makeRewardedVisible(), called only after the member's explicit press;
 * `rewardedSlotGranted` when the reward is earned; `rewardedSlotClosed` when
 * the member closes it; `slotRenderEnded` with isEmpty when there is no ad.
 * The slot is destroyed when it closes, and only one exists at a time.
 *
 * Loaded on the member's first press only, never with the page, and from
 * GPT's limited-ads address so that, without the member's cookie consent
 * (lib/consent.ts), ads are requested in limited and non-personalised mode
 * (no cookies or local storage).
 *
 * The browser's events decide nothing: they only tell the server which step
 * the member reached (lib/earn/rewarded-ads.ts).
 */

type Slot = object;
type SlotEvent = { slot: Slot };
type ReadyEvent = SlotEvent & { makeRewardedVisible: () => boolean | void };
type RenderEvent = SlotEvent & { isEmpty: boolean };
type Listener = (event: unknown) => void;

type PubAds = {
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  setPrivacySettings: (settings: { limitedAds?: boolean; nonPersonalizedAds?: boolean }) => void;
};

export type GoogleTag = {
  cmd: { push: (callback: () => void) => void } | (() => void)[];
  apiReady?: boolean;
  pubads: () => PubAds;
  defineOutOfPageSlot: (path: string, format: unknown) => (Slot & { addService: (service: PubAds) => Slot }) | null;
  enums: { OutOfPageFormat: { REWARDED: unknown } };
  enableServices: () => void;
  display: (slot: Slot) => void;
  destroySlots: (slots: Slot[]) => boolean;
  setConfig?: (config: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    googletag?: GoogleTag;
  }
}

/** How long GPT may take to arrive, and then an ad to be ready, before we say so. */
export const SCRIPT_TIMEOUT_MS = 15_000;
export const READY_TIMEOUT_MS = 30_000;

let loading: Promise<boolean> | null = null;

/** Adds gpt.js once. False when it cannot load: blocked, offline, or it never became ready. */
export function loadGpt(doc: Document = document, win: Window = window): Promise<boolean> {
  if (win.googletag?.apiReady) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    win.googletag = win.googletag ?? ({ cmd: [] } as unknown as GoogleTag);
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      win.clearTimeout(timer);
      if (!ok) loading = null;
      resolve(ok);
    };
    const timer = win.setTimeout(() => done(false), SCRIPT_TIMEOUT_MS);
    const script = doc.createElement("script");
    script.src = GPT_SCRIPT_URL;
    script.async = true;
    script.onerror = () => done(false);
    // A blocker can answer with an empty script: wait for GPT's own "ready" through its queue.
    script.onload = () => win.googletag?.cmd.push(() => done(Boolean(win.googletag?.apiReady)));
    doc.head.appendChild(script);
  });
  return loading;
}

export type RewardedOutcome = "granted" | "closed_early" | "no_fill" | "unsupported" | "timeout";

export type RewardedHandlers = {
  /** The ad is ready: show the opt-in; call `show()` on the member's press. */
  onReady: (show: () => boolean) => void;
  /** The reward was earned (rewardedSlotGranted). */
  onGranted: () => void;
  /** It is over: closed (after a reward or early), no ad, unsupported, or no answer in time. */
  onEnd: (outcome: RewardedOutcome) => void;
};

/**
 * Requests one rewarded ad. Returns a function that abandons it (destroys the
 * slot and stops listening), for "Not now" and for leaving the page.
 */
export function requestRewardedAd(
  googletag: GoogleTag,
  adUnitPath: string,
  personalised: boolean,
  handlers: RewardedHandlers,
  win: Pick<Window, "setTimeout" | "clearTimeout"> = window,
): () => void {
  let slot: Slot | null = null;
  let granted = false;
  let over = false;
  const listeners: [string, Listener][] = [];

  const finish = (outcome: RewardedOutcome) => {
    if (over) return;
    over = true;
    cleanup();
    handlers.onEnd(outcome);
  };
  const cleanup = () => {
    win.clearTimeout(timer);
    const pubads = googletag.pubads();
    for (const [type, listener] of listeners) pubads.removeEventListener(type, listener);
    listeners.length = 0;
    if (slot) googletag.destroySlots([slot]);
    slot = null;
  };
  const timer = win.setTimeout(() => finish("timeout"), READY_TIMEOUT_MS);

  googletag.cmd.push(() => {
    if (over) return;
    const pubads = googletag.pubads();
    // Creatives in cross-origin SafeFrames: a same-origin frame would inherit the page's strict policy (security-headers.ts).
    googletag.setConfig?.({ safeFrame: { forceSafeFrame: true } });
    // Without consent: limited ads (no cookies or local storage), never personalised.
    pubads.setPrivacySettings({ limitedAds: !personalised, nonPersonalizedAds: !personalised });
    const defined = googletag.defineOutOfPageSlot(adUnitPath, googletag.enums.OutOfPageFormat.REWARDED);
    // Null when the page or the device does not support rewarded ads.
    if (!defined) return finish("unsupported");
    slot = defined;
    defined.addService(pubads);

    const on = <E>(type: string, listener: (event: E) => void) => {
      const wrapped = ((event: E & SlotEvent) => {
        if (!over && event.slot === slot) listener(event);
      }) as Listener;
      listeners.push([type, wrapped]);
      pubads.addEventListener(type, wrapped);
    };
    on<ReadyEvent>("rewardedSlotReady", (event) => {
      win.clearTimeout(timer);
      handlers.onReady(() => event.makeRewardedVisible() !== false);
    });
    on<SlotEvent>("rewardedSlotGranted", () => {
      granted = true;
      handlers.onGranted();
    });
    on<SlotEvent>("rewardedSlotClosed", () => finish(granted ? "granted" : "closed_early"));
    on<RenderEvent>("slotRenderEnded", (event) => {
      if (event.isEmpty) finish("no_fill");
    });

    googletag.enableServices();
    googletag.display(defined);
  });

  return () => {
    if (over) return;
    over = true;
    cleanup();
  };
}
