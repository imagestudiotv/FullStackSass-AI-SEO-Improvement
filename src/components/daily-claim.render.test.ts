import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { DAILY_CLAIM_COPY, dailyWhen } from "@/lib/i18n/daily-claim";

/**
 * The check-in's launchers, from the status the server gives them: the real
 * amount for the plan, and "Claimed" only when the ledger holds today's grant. The claim itself is tested on real Postgres
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

function render(status: object, locale: (typeof LOCALES)[number] = "en", variant: "row" | "chip" | "button" = "row") {
  return renderToStaticMarkup(createElement(DailyClaim, { status: status as never, copy: DAILY_CLAIM_COPY[locale], locale, variant }));
}

describe("the sidebar's row", () => {
  const claimed = { ...PAID, today: 3, claimable: false, nextAt: new Date("2026-11-06T00:00:00Z") };

  it("while open, offers the claim with the plan's real amount", () => {
    const html = render(PAID);
    expect(html).toContain("Daily bonus");
    expect(html).toContain("3 free credits available");
    expect(html).toContain("Claim +3");
    expect(html).not.toContain("aria-disabled");
  });

  it("on a trial, offers the trial's amount and never 3", () => {
    const html = render(TRIAL);
    expect(html).toContain("15 free credits available");
    expect(html).toContain("Claim +15");
    expect(html).not.toContain("+3");
  });

  it("stays once claimed: disabled, saying so", () => {
    const html = render(claimed);
    expect(html).toContain("Daily bonus claimed");
    expect(html).toContain("Come back tomorrow");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Claim +");
  });

  it("says it in every language, with one amount and no leftover placeholder", () => {
    for (const locale of LOCALES) {
      const copy = DAILY_CLAIM_COPY[locale];
      expect(render(PAID, locale)).toContain(copy.bonusClaim.replace("{count}", "3"));
      expect(render(PAID, locale)).not.toMatch(/[{}|]/);
      expect(render(claimed, locale)).toContain(copy.bonusClaimed);
    }
  });

  it("on a trial's last day, promises no tomorrow", () => {
    const html = render({ ...TRIAL, today: 15, claimable: false, nextAt: null });
    expect(html).toContain("Your trial credits are all collected");
    expect(html).not.toContain("Come back tomorrow");
  });

  it("is not shown when there is nothing to claim", () => {
    expect(render({ ...PAID, plan: "none", eligible: false, claimable: false })).toBe("");
    expect(render({ ...PAID, perDay: 0, claimable: false })).toBe("");
  });
});

describe("the other launchers", () => {
  it("name the real amount, and the phone chip only appears while open", () => {
    expect(render(TRIAL, "en", "button")).toContain("Claim 15 credits");
    expect(render(TRIAL, "en", "chip")).toContain("+15");
    expect(render({ ...PAID, today: 3, claimable: false }, "en", "chip")).toBe("");
    expect(render({ ...PAID, today: 3, claimable: false }, "en", "button")).toContain("View daily rewards");
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
