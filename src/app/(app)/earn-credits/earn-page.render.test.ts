import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Earn Credits page's first render (client design and ticket, 2026-11-05):
 * the account's own code, link and balance, never the design's demo figures;
 * the share kit; and a daily card that is honest for every state of the plan.
 * The claim itself is tested on real Postgres (lib/credits/daily.concurrency.test.ts).
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/auth-guard", () => ({ requireSession: async () => ({ user: { id: "user_1" } }) }));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: "org_1" }) }));
vi.mock("@/lib/websites/accessible", () => ({ hasOnlySharedWork: async () => false }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});
vi.mock("@/lib/credits/daily-actions", () => ({ claimDailyCreditsAction: vi.fn() }));

const claimAction = vi.hoisted(() => ({ submit: vi.fn(), enter: vi.fn() }));
vi.mock("@/lib/earn/actions", () => ({
  canEnterReferralCode: async () => false,
  listEarnClaims: async () => [],
  submitEarnClaim: claimAction.submit,
  enterReferralCode: claimAction.enter,
}));
vi.mock("@/lib/referrals/actions", () => ({
  getReferralSummary: async () => ({ code: "OWN1CODE", earned: 0, pending: 0, referrals: [] }),
}));

const paid = { plan: "paid", eligible: true, perDay: 7, paidPerDay: 7, today: 0, claimable: true, nextAt: null, streak: 0, progress: [], trialEndsAt: null };
const state = vi.hoisted(() => ({ overview: null as unknown }));
vi.mock("@/lib/credits/overview-request", () => ({ creditOverviewForRequest: async () => state.overview }));

import EarnCreditsPage from "./page";

async function render(daily: Record<string, unknown>) {
  state.overview = { balance: 41, reserved: 0, available: 41, daily: { ...paid, ...daily }, settings: {} };
  return renderToStaticMarkup(await EarnCreditsPage());
}

beforeEach(() => {
  claimAction.submit.mockClear();
  claimAction.enter.mockClear();
});

describe("the Earn Credits page", () => {
  it("shows this account's own code, link and balance, and none of the design's demo values", async () => {
    const html = await render({});
    expect(html).toContain("OWN1CODE");
    expect(html).toContain("/r/OWN1CODE");
    expect(html).toContain("41 available");
    expect(html).not.toContain("MUH7XWWT");
    expect(html).not.toContain(">263");
  });

  it("puts the account's link in the share kit's first template, with its disclosure", async () => {
    const html = await render({});
    expect(html).toContain('id="share-kit"');
    const area = /<textarea[^>]*>([^<]*)<\/textarea>/.exec(html)?.[1] ?? "";
    expect(area).toContain("/r/OWN1CODE");
    expect(area).toContain("I may receive RepGet credits");
  });

  it("reads the reward figures from their canonical values", async () => {
    const html = await render({});
    expect(html).toContain("+20 credits");
    expect(html).toContain("+100 credits");
  });

  it("sets the artwork's words as HTML, with the reward from its canonical value", async () => {
    const html = await render({});
    expect(html).toContain("/images/earn/referral-invite.webp");
    expect(html).toContain("+100");
    expect(html).toContain("Friend joined");
    expect(html).toContain("Four people connected to RepGet, and a reward of 100 credits");
  });

  it("rendering sends no claim and enters no code", async () => {
    await render({});
    expect(claimAction.submit).not.toHaveBeenCalled();
    expect(claimAction.enter).not.toHaveBeenCalled();
  });

  it("keeps the honest-feedback and incentive disclosure on the post claim", async () => {
    const html = await render({});
    expect(html).toContain("Share an honest post");
  });

  describe("the daily card", () => {
    it("open: offers the claim with the real amount, nothing collected yet", async () => {
      const html = await render({});
      expect(html).toContain("Claim 7 credits");
      expect(html).toContain("Not collected yet");
      expect(html).not.toContain("added automatically");
    });

    it("claimed: says what the ledger holds and when the next opens, in UTC", async () => {
      const html = await render({ today: 3, claimable: false, nextAt: new Date("2026-11-06T00:00:00Z") });
      expect(html).toContain("+3 added");
      expect(html).toContain("Next check-in: 6 Nov");
      expect(html).toContain("UTC");
      expect(html).toContain("View daily rewards");
      expect(html).not.toContain("Claim 7 credits");
    });

    it("trial: the trial's amount and days, not the paid plan's", async () => {
      const html = await render({ plan: "trial", perDay: 15, paidPerDay: 3, trialEndsAt: new Date("2026-11-07T23:00:00Z") });
      expect(html).toContain("Claim 15 credits");
      expect(html).toContain("your first 3 days, until 7 November");
    });

    it("trial over: says they ended, offers no claim", async () => {
      const html = await render({ plan: "trial_over", eligible: false, perDay: 3, paidPerDay: 3, claimable: false, trialEndsAt: new Date("2026-11-01T00:00:00Z") });
      expect(html).toContain("daily credits have ended");
      expect(html).not.toContain("Claim 3");
      expect(html).not.toContain("Check in once a day to collect your daily credits");
    });

    it("no plan: says so honestly, offers plans rather than a claim", async () => {
      const html = await render({ plan: "none", eligible: false, perDay: 3, paidPerDay: 3, claimable: false });
      expect(html).toContain("no daily credits");
      expect(html).toContain("With a paid plan you can collect 3 credits");
      expect(html).toContain('href="/billing#plan"');
      expect(html).not.toContain("Claim 3");
    });

    it("switched off: no claim and no promise of credits", async () => {
      const html = await render({ perDay: 0, paidPerDay: 0, claimable: false });
      expect(html).toContain("no daily credits");
      expect(html).not.toContain("Claim 0");
      expect(html).not.toContain("With a paid plan you can collect");
    });
  });
});
