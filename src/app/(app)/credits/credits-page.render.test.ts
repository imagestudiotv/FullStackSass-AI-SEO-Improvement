import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The Credits page's first render (client design, 2026-11-02): the balance
 * with today's credits earned and used, the condensed prices, the ways to get
 * more, and the history with its All / Earned / Spent filter and paging - all
 * from the figures the ledger gives, never made up. The ledger queries
 * themselves are tested against a database in lib/credits/spend.test.ts.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    // `scroll` is Link's own option, not an attribute of the anchor.
    createElement("a", { href, ...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== "scroll")) }, children),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/auth-guard", () => ({ requireSession: async () => ({ user: { id: "user_1" } }) }));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: "org_1" }) }));
vi.mock("@/lib/backlinks/managed", () => ({ MIN_PLACEMENT_CREDITS: 10, MAX_PLACEMENT_CREDITS: 100 }));

const state = vi.hoisted(() => ({ locale: "en" as Locale, guest: false }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: state.locale, t: getMessages(state.locale) }) };
});
vi.mock("@/lib/websites/accessible", () => ({ hasOnlySharedWork: async () => state.guest }));
vi.mock("@/lib/credits/addons", () => ({
  creditAddons: async () => [{ id: "a1", name: "Top 250 live USA Local Citations", kind: "service", creditPrice: 250 }],
}));

const ledger = vi.hoisted(() => ({
  creditOverview: vi.fn(),
  creditHistory: vi.fn(),
  creditToday: vi.fn(),
}));
// The filter's parsing is the real one; the queries are stubs.
vi.mock("@/lib/credits/overview", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/credits/overview")>()),
  ...ledger,
}));

import CreditsPage from "./page";

const en = getMessages("en").app.credits;

const OVERVIEW = {
  balance: 140,
  reserved: 20,
  available: 120,
  daily: { eligible: true, perDay: 3, today: 3, trialEndsAt: null },
  settings: {
    dailyFree: 3,
    trialDailyFree: 15,
    prices: { audit_rerun: 5, social_post: 1, video_post: 1, chat_message: 1 },
    updatedAt: null,
    updatedBy: null,
  },
};

const ROWS = [
  { id: "r1", at: new Date("2026-11-03T08:00:00Z"), type: "spend", amount: -1, note: null, action: "video_post", addonName: null, websiteDomain: "example.com" },
  { id: "r2", at: new Date("2026-11-03T00:10:00Z"), type: "daily_grant", amount: 3, note: "Daily credits", action: null, addonName: null, websiteDomain: null },
];

function history(over: Partial<{ rows: unknown[]; total: number; page: number; pageCount: number }> = {}) {
  return { rows: ROWS, total: 2, page: 1, pageCount: 1, pageSize: 25, ...over };
}

async function render(search: Record<string, string> = {}) {
  const page = await CreditsPage({ searchParams: Promise.resolve(search), params: Promise.resolve({}) } as never);
  return renderToStaticMarkup(page);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.guest = false;
  ledger.creditOverview.mockResolvedValue(OVERVIEW);
  ledger.creditToday.mockResolvedValue({ earned: 103, used: 21 });
  ledger.creditHistory.mockResolvedValue(history());
});

describe("the Credits page", () => {
  it("shows the balance with what was earned and used today, from the ledger", async () => {
    const html = await render();
    expect(html).toContain(en.availableBalance);
    expect(html).toContain(">120<");
    expect(html).toContain(en.earnedToday);
    expect(html).toContain(">+103<");
    expect(html).toContain(en.usedToday);
    expect(html).toContain(">21<");
    // What backlinks hold, and why, stay beside the balance.
    expect(html).toContain(en.reserved);
    expect(html).toContain(">20<");
    expect(html).toContain(">140<");
    expect(html).toContain(en.reservedHelp);
    expect(html).toContain(en.todayNote);
    expect(ledger.creditToday).toHaveBeenCalledWith("org_1");
  });

  it("says nothing was earned today as 0, not +0", async () => {
    ledger.creditToday.mockResolvedValue({ earned: 0, used: 0 });
    const html = await render();
    expect(html).not.toContain("+0<");
  });

  it("buys credits where the sidebar does, and links to Earn Credits", async () => {
    const html = await render();
    expect(html).toContain('href="/billing#addons"');
    expect(html).toContain('href="/earn-credits"');
    expect(html).toContain(en.sourceTopUp);
    expect(html).toContain(en.sourceExplore);
  });

  it("lists the most-used actions first, and the rest behind See all", async () => {
    const html = await render();
    const toggle = html.indexOf(en.pricesAll);
    expect(toggle).toBeGreaterThan(0);
    for (const action of ["social_post", "video_post", "chat_message", "audit_rerun"] as const) {
      expect(html.indexOf(en.actions[action])).toBeLessThan(toggle);
    }
    expect(html.indexOf(en.backlink)).toBeGreaterThan(toggle);
    expect(html.indexOf("Top 250 live USA Local Citations")).toBeGreaterThan(toggle);
    expect(html).toContain("<details");
  });

  it("offers All, Earned and Spent, marking the one shown, and asks the ledger for it", async () => {
    const html = await render({ kind: "earned" });
    expect(ledger.creditHistory).toHaveBeenCalledWith("org_1", { page: 1, pageSize: 25, kind: "earned" });
    expect(html).toContain('href="/credits"');
    expect(html).toContain('href="/credits?kind=spent"');
    expect(html).toMatch(/href="\/credits\?kind=earned" aria-current="true"/);
    expect(html).not.toMatch(/href="\/credits\?kind=spent" aria-current/);
  });

  it("reads an unknown filter as All", async () => {
    await render({ kind: "nonsense", page: "x" });
    expect(ledger.creditHistory).toHaveBeenCalledWith("org_1", { page: 1, pageSize: 25, kind: "all" });
  });

  it("pages within the filter", async () => {
    ledger.creditHistory.mockResolvedValue(history({ total: 60, page: 2, pageCount: 3 }));
    const html = await render({ kind: "spent", page: "2" });
    expect(ledger.creditHistory).toHaveBeenCalledWith("org_1", { page: 2, pageSize: 25, kind: "spent" });
    expect(html).toContain('href="/credits?kind=spent#credit-history"');
    expect(html).toContain('href="/credits?kind=spent&amp;page=3#credit-history"');
    expect(html).toContain(en.spentNote);
  });

  it("says when a filter has nothing", async () => {
    ledger.creditHistory.mockResolvedValue(history({ rows: [], total: 0 }));
    expect(await render({ kind: "earned" })).toContain(en.emptyEarned);
    expect(await render({ kind: "spent" })).toContain(en.emptySpent);
    expect(await render()).toContain(en.empty);
  });

  it("keeps the history's columns, and its id for the sidebar's View history", async () => {
    const html = await render();
    for (const column of [en.colDate, en.colEntry, en.colWebsite, en.colCredits]) expect(html).toContain(column);
    expect(html).toContain('id="credit-history"');
    expect(html).toContain("example.com");
    expect(html).toContain(">-1<");
    expect(html).toContain(">+3<");
  });

  it("tells someone with only shared websites that credits are their owner's", async () => {
    state.guest = true;
    const html = await render();
    // The markup escapes the apostrophe in "owner's".
    expect(html).toContain(en.guestOnly.replaceAll("'", "&#x27;"));
    expect(ledger.creditOverview).not.toHaveBeenCalled();
  });

  it.each(LOCALES)("has every word in %s", async (locale) => {
    state.locale = locale;
    const html = await render({ kind: "spent" });
    const c = getMessages(locale).app.credits;
    for (const key of ["availableBalance", "earnedToday", "usedToday", "pricesAll", "sourcesTitle", "filterSpent", "spentNote"] as const) {
      expect(c[key]).toBeTruthy();
    }
    expect(html).not.toContain("undefined");
    expect(html).not.toMatch(/\{[a-z]+\}/);
  });
});
