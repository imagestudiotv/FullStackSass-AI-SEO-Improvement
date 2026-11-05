import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { DAILY_CLAIM_COPY, dailyWhen } from "@/lib/i18n/daily-claim";

/**
 * The check-in's launchers, from the status the server gives them: the real
 * amount for the plan, and the banner's "Claimed today" only when the ledger
 * holds today's grant. The claim itself is tested on real Postgres
 * (lib/credits/daily.concurrency.test.ts); the modal, which opens only in a
 * browser, is checked headless.
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/credits/daily-actions", () => ({ claimDailyCreditsAction: vi.fn() }));

import { DailyClaim } from "./daily-claim";

const PAID = { plan: "paid", eligible: true, perDay: 3, paidPerDay: 3, today: 0, claimable: true, nextAt: null, streak: 0, progress: [], trialEndsAt: null } as const;
const TRIAL = { ...PAID, plan: "trial", perDay: 15, trialEndsAt: new Date("2026-11-08T23:00:00Z") } as const;

function render(status: object, locale: (typeof LOCALES)[number] = "en", variant: "banner" | "row" | "chip" | "button" = "banner") {
  return renderToStaticMarkup(createElement(DailyClaim, { status: status as never, copy: DAILY_CLAIM_COPY[locale], locale, variant }));
}

describe("the dashboard banner", () => {
  it("while open, offers the claim with the plan's real amount", () => {
    const html = render(PAID);
    expect(html).toContain("Show up daily");
    expect(html).toContain("Claim 3 credits");
    expect(html).not.toContain("Claimed today");
    expect(html).not.toContain("aria-disabled");
  });

  it("on a trial, offers the trial's amount and never 3", () => {
    const html = render(TRIAL);
    expect(html).toContain("Claim 15 credits");
    expect(html).toContain("get 15 credits");
    expect(html).not.toMatch(/\b3 credits/);
  });

  it("stays once claimed: disabled, saying so, with the next opening", () => {
    const html = render({ ...PAID, today: 3, claimable: false, nextAt: new Date("2026-11-06T00:00:00Z") });
    expect(html).toContain("Show up daily");
    expect(html).toContain("Claimed today");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Next check-in: 6 Nov, 00:00 UTC");
    expect(html).not.toContain("Claim 3 credits");
  });

  it("says Claimed today in every language", () => {
    for (const locale of LOCALES) {
      const word = DAILY_CLAIM_COPY[locale].claimedToday;
      expect(word.length).toBeGreaterThan(0);
      expect(render({ ...PAID, today: 3, claimable: false, nextAt: new Date("2026-11-06T00:00:00Z") }, locale)).toContain(word);
    }
  });

  it("on a trial's last day, says what comes next, without a next check-in", () => {
    const html = render({ ...TRIAL, today: 15, claimable: false, nextAt: null });
    expect(html).toContain("Claimed today");
    expect(html).toContain("With a paid plan you can collect 3 credits");
    expect(html).not.toContain("Next check-in");
  });

  it("is not shown when there is nothing to claim", () => {
    expect(render({ ...PAID, plan: "none", eligible: false, claimable: false })).toBe("");
    expect(render({ ...PAID, perDay: 0, claimable: false })).toBe("");
  });
});

describe("the other launchers", () => {
  it("name the real amount, and the phone chip only appears while open", () => {
    expect(render(TRIAL, "en", "row")).toContain("Claim 15 credits");
    expect(render(TRIAL, "en", "chip")).toContain("+15");
    expect(render({ ...PAID, today: 3, claimable: false }, "en", "chip")).toBe("");
    expect(render({ ...PAID, today: 3, claimable: false }, "en", "row")).toContain("View daily rewards");
  });
});

describe("the next opening as printed", () => {
  it("is the backend's moment, in UTC, for a paid midnight and a trial's 24-hour mark", () => {
    expect(dailyWhen(new Date("2026-11-06T00:00:00Z"), "en")).toBe("6 Nov, 00:00 UTC");
    expect(dailyWhen(new Date("2026-11-03T23:00:00Z"), "en")).toBe("3 Nov, 23:00 UTC");
    for (const locale of LOCALES) {
      const midnight = dailyWhen(new Date("2026-11-06T00:00:00Z"), locale);
      expect(midnight).toContain("00:00");
      expect(midnight).toContain("UTC");
    }
  });
});
