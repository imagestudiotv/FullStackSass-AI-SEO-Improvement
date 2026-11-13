import { describe, expect, it, vi } from "vitest";

import { TEST_AD_UNIT_PATH } from "@/lib/earn/rewarded-ads-config";

import { requestRewardedAd, type GoogleTag } from "./rewarded-ad-gpt";

/**
 * The browser side of "Watch an ad to earn credits" against a stand-in for
 * Google Publisher Tag (no network, no ad): the slot is shown only on the
 * member's press, the reward is reported only on rewardedSlotGranted, a close
 * before it is "closed_early", no ad is "no_fill", an unsupported page is
 * "unsupported", and the slot is always destroyed.
 */

function fakeGoogletag(options: { supported?: boolean } = {}) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const slot = { addService: vi.fn(() => slot) };
  const privacy: unknown[] = [];
  const config: unknown[] = [];
  const pubads = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => listeners.get(type)?.delete(listener),
    setPrivacySettings: (settings: unknown) => privacy.push(settings),
  };
  const googletag = {
    cmd: { push: (callback: () => void) => callback() },
    apiReady: true,
    pubads: () => pubads,
    defineOutOfPageSlot: vi.fn(() => (options.supported === false ? null : slot)),
    enums: { OutOfPageFormat: { REWARDED: "REWARDED" } },
    enableServices: vi.fn(),
    display: vi.fn(),
    destroySlots: vi.fn(() => true),
    setConfig: (value: unknown) => config.push(value),
  } satisfies GoogleTag;
  const fire = (type: string, event: Record<string, unknown> = {}) => {
    for (const listener of [...(listeners.get(type) ?? [])]) listener({ slot, ...event });
  };
  const listening = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
  return { googletag, slot, fire, privacy, config, listening };
}

const timers = { setTimeout: (() => 1) as unknown as Window["setTimeout"], clearTimeout: () => {} };

function handlers() {
  return { onReady: vi.fn(), onGranted: vi.fn(), onEnd: vi.fn() };
}

describe("requesting a rewarded ad", () => {
  it("defines GPT's rewarded slot, and shows it only when the member presses", () => {
    const fake = fakeGoogletag();
    const h = handlers();
    requestRewardedAd(fake.googletag, TEST_AD_UNIT_PATH, false, h, timers);
    expect(fake.googletag.defineOutOfPageSlot).toHaveBeenCalledWith(TEST_AD_UNIT_PATH, "REWARDED");
    expect(fake.googletag.display).toHaveBeenCalledWith(fake.slot);
    expect(fake.config).toEqual([{ safeFrame: { forceSafeFrame: true } }]);

    const makeRewardedVisible = vi.fn(() => true);
    fake.fire("rewardedSlotReady", { makeRewardedVisible });
    expect(h.onReady).toHaveBeenCalledOnce();
    expect(makeRewardedVisible).not.toHaveBeenCalled();
    const show = h.onReady.mock.calls[0][0] as () => boolean;
    expect(show()).toBe(true);
    expect(makeRewardedVisible).toHaveBeenCalledOnce();
  });

  it("reports the reward only on rewardedSlotGranted, and ends as granted when closed after it", () => {
    const fake = fakeGoogletag();
    const h = handlers();
    requestRewardedAd(fake.googletag, TEST_AD_UNIT_PATH, true, h, timers);
    fake.fire("rewardedSlotReady", { makeRewardedVisible: () => true });
    fake.fire("rewardedSlotVideoCompleted");
    expect(h.onGranted).not.toHaveBeenCalled();
    fake.fire("rewardedSlotGranted", { payload: { type: "credits", amount: 1 } });
    expect(h.onGranted).toHaveBeenCalledOnce();
    fake.fire("rewardedSlotClosed");
    expect(h.onEnd).toHaveBeenCalledWith("granted");
    expect(fake.googletag.destroySlots).toHaveBeenCalledWith([fake.slot]);
    expect(fake.listening()).toBe(0);
  });

  it("ends as closed_early when closed before the reward", () => {
    const fake = fakeGoogletag();
    const h = handlers();
    requestRewardedAd(fake.googletag, TEST_AD_UNIT_PATH, false, h, timers);
    fake.fire("rewardedSlotReady", { makeRewardedVisible: () => true });
    fake.fire("rewardedSlotClosed");
    expect(h.onGranted).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledWith("closed_early");
    // Nothing after the end counts.
    fake.fire("rewardedSlotGranted");
    expect(h.onGranted).not.toHaveBeenCalled();
  });

  it("ends as no_fill when there is no ad, and as unsupported when the page cannot have one", () => {
    const empty = fakeGoogletag();
    const h = handlers();
    requestRewardedAd(empty.googletag, TEST_AD_UNIT_PATH, false, h, timers);
    empty.fire("slotRenderEnded", { isEmpty: true });
    expect(h.onEnd).toHaveBeenCalledWith("no_fill");

    const unsupported = fakeGoogletag({ supported: false });
    const u = handlers();
    requestRewardedAd(unsupported.googletag, TEST_AD_UNIT_PATH, false, u, timers);
    expect(u.onEnd).toHaveBeenCalledWith("unsupported");
    expect(unsupported.googletag.display).not.toHaveBeenCalled();
  });

  it("asks for limited, non-personalised ads without the member's cookie consent", () => {
    const without = fakeGoogletag();
    requestRewardedAd(without.googletag, TEST_AD_UNIT_PATH, false, handlers(), timers);
    expect(without.privacy).toEqual([{ limitedAds: true, nonPersonalizedAds: true }]);
    const withConsent = fakeGoogletag();
    requestRewardedAd(withConsent.googletag, TEST_AD_UNIT_PATH, true, handlers(), timers);
    expect(withConsent.privacy).toEqual([{ limitedAds: false, nonPersonalizedAds: false }]);
  });

  it("can be abandoned (Not now, leaving the page): the slot is destroyed and nothing more is reported", () => {
    const fake = fakeGoogletag();
    const h = handlers();
    const abandon = requestRewardedAd(fake.googletag, TEST_AD_UNIT_PATH, false, h, timers);
    abandon();
    expect(fake.googletag.destroySlots).toHaveBeenCalledOnce();
    fake.fire("rewardedSlotReady", { makeRewardedVisible: () => true });
    expect(h.onReady).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();
  });

  it("gives up when no ad is ready in time", () => {
    const fake = fakeGoogletag();
    const h = handlers();
    let fireTimeout: () => void = () => {};
    requestRewardedAd(fake.googletag, TEST_AD_UNIT_PATH, false, h, {
      setTimeout: ((callback: () => void) => {
        fireTimeout = callback;
        return 1;
      }) as unknown as Window["setTimeout"],
      clearTimeout: () => {},
    });
    fireTimeout();
    expect(h.onEnd).toHaveBeenCalledWith("timeout");
    expect(fake.googletag.destroySlots).toHaveBeenCalledOnce();
  });
});
