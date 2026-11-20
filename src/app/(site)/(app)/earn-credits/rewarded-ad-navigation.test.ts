import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/earn/rewarded-ads-actions", () => ({ startRewardedAdAction: vi.fn(), claimRewardedAdAction: vi.fn(), endRewardedAdAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { loadedOnEarnCredits, WATCH_URL } from "./rewarded-ad-card";

/**
 * "On dashboard the video ads are not displaying" (ticket 2026-11-19): Earn
 * Credits reached by an in-app link keeps the previous document's CSP, which
 * blocks Google Publisher Tag. The card loads the page for real before
 * requesting an ad when the document was loaded anywhere else.
 */
describe("loadedOnEarnCredits", () => {
  it("is true only for a document loaded on /earn-credits itself", () => {
    expect(loadedOnEarnCredits({ name: "https://www.repget.com/earn-credits" })).toBe(true);
    expect(loadedOnEarnCredits({ name: "https://www.repget.com/earn-credits?watch=1" })).toBe(true);
    expect(loadedOnEarnCredits({ name: "https://www.repget.com/dashboard" })).toBe(false);
    expect(loadedOnEarnCredits({ name: "https://www.repget.com/credits" })).toBe(false);
  });

  it("does not block the ad when the browser cannot say", () => {
    expect(loadedOnEarnCredits(undefined)).toBe(true);
    expect(loadedOnEarnCredits({ name: "not a url" })).toBe(true);
  });

  it("reloads into Earn Credits itself, where the proxy allows GPT", () => {
    expect(new URL(WATCH_URL, "https://www.repget.com").pathname).toBe("/earn-credits");
  });
});
