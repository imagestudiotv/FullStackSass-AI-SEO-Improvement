import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The Billing page by behaviour: which of the existing buttons each
 * website's processor can actually complete, how statuses, prices and
 * allowances read in every language, and what the history and add-on panels
 * show. Rendered to static markup (no DOM); provider calls are stubs and are
 * never reached by rendering.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/stripe/actions", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/lib/paypal/actions", () => ({ createPayPalCheckout: vi.fn(), confirmPayPalReturn: vi.fn() }));
vi.mock("@/lib/stripe/portal", () => ({ createPortalSession: vi.fn() }));

import type { PaymentRow } from "@/lib/billing";
import type { CurrentSubscription, PlanRow, WebsiteSubscription } from "@/lib/billing-shared";
import { BILLING_PLANS_COPY } from "@/lib/i18n/billing-plans";
import { getMessages } from "@/lib/i18n/messages";

import { BillingClient } from "./billing-client";
import {
  formatMoney,
  packsReturnPath,
  paymentOptions,
  payPalForPlan,
  payPalIntervalBlocked,
  planFeatures,
  selectedPlanOf,
  subscriptionStatus,
  upgradeSentence,
  withoutReturnParams,
} from "./billing-view";
import { PaymentsPanel } from "./payments-panel";
import { planMethods } from "./plan-picker";

const en = getMessages("en").app;
const de = getMessages("de").app;
const html = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);
/** Intl puts a no-break space between "99" and "€" in German; compare on plain spaces. */
const plain = (value: string) => value.replace(/[  ]/g, " ");

function sub(overrides: Partial<CurrentSubscription> = {}): CurrentSubscription {
  return {
    status: "active",
    planId: "plan_grow",
    planName: "Grow",
    tier: "grow",
    interval: "month",
    currentPeriodEnd: new Date(Date.UTC(2026, 10, 3)),
    cancelAtPeriodEnd: false,
    cancelAt: null,
    hasCustomer: true,
    provider: "stripe",
    ...overrides,
  };
}

function plan(overrides: Partial<PlanRow>): PlanRow {
  return {
    id: "plan_grow",
    name: "Grow",
    tier: "grow",
    interval: "month",
    priceCents: 9900,
    currency: "eur",
    articleLimit: 30,
    keywordLimit: 300,
    monthlyCredits: 25,
    siteLimit: 3,
    sortOrder: 1,
    isActive: true,
    stripePriceId: "price_grow",
    paypalPlanId: "P-GROW",
    ...overrides,
  } as PlanRow;
}

const GROW = plan({});
const SCALE = plan({
  id: "plan_scale",
  name: "Scale",
  tier: "scale",
  priceCents: 29900,
  articleLimit: 100,
  keywordLimit: 1500,
  monthlyCredits: 60,
  sortOrder: 2,
  paypalPlanId: "P-SCALE",
});

describe("payment options per website", () => {
  it("a site with no plan can start either processor", () => {
    const options = paymentOptions(null, true);
    expect(options).toMatchObject({ billedBy: null, card: true, paypal: true, manageInStripe: false, cancelInStripe: false });
  });

  it("a live card subscription keeps PayPal off and offers Stripe's manage and cancel", () => {
    const options = paymentOptions(sub(), true);
    expect(options).toMatchObject({
      billedBy: "stripe",
      card: true,
      paypal: false,
      manageInStripe: true,
      cancelInStripe: true,
      manageInPayPal: false,
    });
  });

  it("a PayPal-billed site in a workspace with a Stripe customer gets PayPal's route, not Stripe's buttons", () => {
    const options = paymentOptions(sub({ provider: "paypal", hasCustomer: true }), true);
    expect(options).toMatchObject({
      billedBy: "paypal",
      card: false,
      paypal: true,
      manageInStripe: false,
      cancelInStripe: false,
      manageInPayPal: true,
    });
  });

  it("does not offer cancelling a subscription that already ends or has ended", () => {
    expect(paymentOptions(sub({ cancelAtPeriodEnd: true }), false).cancelInStripe).toBe(false);
    const ended = paymentOptions(sub({ status: "canceled" }), true);
    expect(ended).toMatchObject({ billedBy: null, cancelInStripe: false, card: true, paypal: true, manageInStripe: true });
  });

  it("an unpaid or incomplete subscription blocks new checkouts until it is settled", () => {
    for (const status of ["unpaid", "incomplete", "paused"]) {
      const options = paymentOptions(sub({ status }), true);
      expect(options).toMatchObject({ unsettled: true, card: false, paypal: false });
    }
    // Winding down is a plan change the server allows.
    expect(paymentOptions(sub({ status: "unpaid", cancelAtPeriodEnd: true }), true).card).toBe(true);
    // past_due is entitled: plan changes stay open.
    expect(paymentOptions(sub({ status: "past_due" }), true)).toMatchObject({ unsettled: false, card: true });
  });

  it("a stored \"inactive\" row is a real subscription: unsettled, checkouts closed, and a card row keeps its Cancel", () => {
    // An operator's deactivation: the row says inactive while Stripe keeps charging.
    expect(paymentOptions(sub({ status: "inactive" }), true)).toMatchObject({
      billedBy: "stripe",
      unsettled: true,
      card: false,
      paypal: false,
      manageInStripe: true,
      cancelInStripe: true,
    });
    // A PayPal status mapStatus does not know.
    expect(paymentOptions(sub({ status: "inactive", provider: "paypal" }), true)).toMatchObject({
      billedBy: "paypal",
      unsettled: true,
      card: false,
      paypal: false,
      manageInPayPal: true,
      cancelInStripe: false,
    });
    // Granted by hand: no processor holds it, so beginCheckout lets either start.
    expect(paymentOptions(sub({ status: "inactive", hasCustomer: false }), true)).toMatchObject({
      billedBy: null,
      unsettled: false,
      card: true,
      paypal: true,
    });
  });

  it("a subscription granted by hand points at support and leaves both processors open", () => {
    const options = paymentOptions(sub({ hasCustomer: false }), true);
    expect(options).toMatchObject({ billedBy: null, managedForYou: true, manageInStripe: false, card: true, paypal: true });
  });

  it("never offers PayPal when it is not configured", () => {
    expect(paymentOptions(null, false).paypal).toBe(false);
    expect(paymentOptions(sub({ provider: "paypal" }), false)).toMatchObject({ card: false, paypal: false });
  });
});

describe("statuses, prices and allowances", () => {
  it("translates every subscription status and keeps past_due a warning", () => {
    expect(subscriptionStatus("past_due", en.billing)).toMatchObject({ label: "Payment overdue", tone: "warning" });
    expect(subscriptionStatus("trialing", de.billing).label).toBe("Kostenlose Testphase");
    expect(subscriptionStatus("canceled", en.billing).label).toBe("Cancelled");
    expect(subscriptionStatus("something_new", en.billing)).toMatchObject({ label: "Something new", tone: "neutral" });
  });

  it("formats the same amount in the reader's convention", () => {
    expect(formatMoney(9900, "eur", "en")).toBe("€99");
    expect(plain(formatMoney(9900, "eur", "de"))).toBe("99 €");
    expect(formatMoney(9950, "EUR", "en")).toBe("€99.50");
  });

  it("reads a negative limit as unlimited, never as -1", () => {
    const unlimited = plan({ articleLimit: -1 });
    expect(planFeatures(unlimited, en.billing, "en")[0]).toBe("Unlimited articles written each month");
  });

  it("adds a plan's social posts after the lines the upgrade strip reads, and none for a plan that states none", () => {
    const stating = { articleLimit: 60, keywordLimit: 300, monthlyCredits: 250, socialPostLimit: 90 } as PlanRow;
    const lines = planFeatures(stating, en.billing, "en");
    expect(lines).toHaveLength(5);
    expect(lines[3]).toBe("250 credits each month");
    expect(lines[4]).toBe("90 social posts each month");
    expect(planFeatures({ ...stating, socialPostLimit: 0 }, en.billing, "en")).toHaveLength(4);
    const sentence = upgradeSentence(plan({ name: "Scale", articleLimit: -1, keywordLimit: 1500 }), en.billing, "en");
    expect(sentence).not.toContain("-1");
    expect(sentence).toContain("1,500 search terms tracked");
    expect(plain(upgradeSentence(SCALE, de.billing, "de"))).toContain("1.500 Suchbegriffe überwacht");
  });

  it("sends an older credits address on to the packs' page, keeping the outcome or the quote", () => {
    expect(packsReturnPath({ addon: "success" })).toBe("/credits/buy?addon=success");
    expect(packsReturnPath({ addon: "pending", via: "paypal" })).toBe("/credits/buy?addon=pending&via=paypal");
    expect(packsReturnPath({ project: "p1", revision: "123" })).toBe("/credits/buy?project=p1&revision=123");
    expect(packsReturnPath({ addon: "cancelled", via: "paypal", project: "p1", revision: "123" })).toBe(
      "/credits/buy?addon=cancelled&via=paypal&project=p1&revision=123",
    );
    // Plans' own addresses stay on Billing.
    for (const params of [{}, { site: "a" }, { checkout: "success" }, { paypal: "success" }, { plan_change: "completed", via: "paypal" }, { plan: "scale" }, { project: "p1" }]) {
      expect(packsReturnPath(params)).toBeNull();
    }
  });

  it("selects the plan a link names only when it is on sale", () => {
    const rows = [GROW, SCALE, plan({ id: "y", tier: "grow", interval: "year" })];
    expect(selectedPlanOf({ plan: "scale" }, rows)).toEqual({ tier: "scale", interval: null });
    expect(selectedPlanOf({ plan: "grow", period: "year" }, rows)).toEqual({ tier: "grow", interval: "year" });
    // No yearly row for it: the plan, on the page's own period.
    expect(selectedPlanOf({ plan: "scale", period: "year" }, rows)).toEqual({ tier: "scale", interval: null });
    expect(selectedPlanOf({ plan: "launch" }, rows)).toBeNull();
    expect(selectedPlanOf({ plan: ["grow", "scale"] }, rows)).toBeNull();
    expect(selectedPlanOf({}, rows)).toBeNull();
  });

  it("drops only the return parameters, keeping the site and the anchor", () => {
    expect(withoutReturnParams("https://app.test/billing?site=abc&paypal=success#plans")).toBe("/billing?site=abc#plans");
    expect(withoutReturnParams("https://app.test/billing?checkout=success&addon=cancelled")).toBe("/billing");
    expect(withoutReturnParams("https://app.test/billing?site=abc")).toBeNull();
  });

  it("drops PayPal's own return parameters too", () => {
    expect(
      withoutReturnParams(
        "https://app.test/billing?paypal=success&site=abc&subscription_id=I-ABC&ba_token=BA-1&token=EC-2#plans",
      ),
    ).toBe("/billing?site=abc#plans");
    expect(withoutReturnParams("https://app.test/billing?site=abc&token=EC-2")).toBe("/billing?site=abc");
  });

  it("offers PayPal on a plan only when the plan exists in PayPal", () => {
    expect(payPalForPlan(GROW, { paypal: true })).toBe(true);
    expect(payPalForPlan(plan({ paypalPlanId: null }), { paypal: true })).toBe(false);
    expect(payPalForPlan(GROW, { paypal: false })).toBe(false);
  });

  it("says PayPal cannot switch monthly <-> yearly, in place of the button, for a website paying by PayPal", () => {
    const monthly = { provider: "paypal", status: "active", interval: "month" };
    const paidByPayPal = { billedBy: "paypal" as const };
    expect(payPalIntervalBlocked(monthly, plan({ interval: "year" }), paidByPayPal)).toBe(true);
    expect(payPalIntervalBlocked({ ...monthly, interval: "year" }, plan({ interval: "month" }), paidByPayPal)).toBe(true);
    // The same period is a plan change PayPal can make.
    expect(payPalIntervalBlocked(monthly, plan({ interval: "month" }), paidByPayPal)).toBe(false);
    // On its PayPal free articles, any plan starts a new subscription: not blocked.
    expect(payPalIntervalBlocked({ ...monthly, status: "trialing" }, plan({ interval: "year" }), paidByPayPal)).toBe(false);
    // Paying by card, or not paying yet: nothing to say.
    expect(payPalIntervalBlocked({ ...monthly, provider: "stripe" }, plan({ interval: "year" }), { billedBy: "stripe" })).toBe(false);
    expect(payPalIntervalBlocked(null, plan({ interval: "year" }), { billedBy: null })).toBe(false);
  });

  it("shows the note, and no PayPal button, on a monthly plan for a yearly PayPal subscriber", () => {
    // The page opens on the subscriber's own period; a tier with no yearly row shows its monthly plan there.
    const markup = html(
      createElement(BillingClient, {
        plans: [plan({ id: "launch-month", tier: "launch", name: "Launch", interval: "month" })],
        subscription: {
          status: "active",
          planId: "grow-year",
          planName: "Grow",
          tier: "grow",
          interval: "year",
          currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
          cancelAtPeriodEnd: false,
          cancelAt: null,
          hasCustomer: false,
          provider: "paypal",
        },
        entitled: true,
        paypalAvailable: true,
        websiteId: "site-1",
        websiteSubscriptions: [],
        viewingSharedDomain: null,
        t: en.billing,
        locale: "en",
        tCommon: en.common,
        paypalIntervalNote: "PayPal cannot switch between monthly and yearly billing.",
      }),
    );
    expect(markup).toContain("PayPal cannot switch between monthly and yearly billing.");
    expect(markup).not.toContain(en.common.payWithPayPal);
  });
});

function renderClient(overrides: Partial<Parameters<typeof BillingClient>[0]> = {}) {
  const site: WebsiteSubscription = { ...sub(), websiteId: "site_a", domain: "alpha.example" };
  return html(
    createElement(BillingClient, {
      plans: [GROW, SCALE],
      subscription: site,
      entitled: true,
      paypalAvailable: true,
      websiteId: "site_a",
      websiteSubscriptions: [site],
      viewingSharedDomain: null,
      t: en.billing,
      locale: "en",
      tCommon: en.common,
      ...overrides,
    }),
  );
}

describe("BillingClient", () => {
  it("names the website the plan belongs to and translates its status", () => {
    const out = renderClient({
      subscription: sub({ status: "past_due" }),
      websiteSubscriptions: [{ ...sub({ status: "past_due" }), websiteId: "site_a", domain: "alpha.example" }],
    });
    expect(out).toContain("Plan for alpha.example");
    expect(out).toContain("Payment overdue");
    expect(out).toContain(en.billing.pastDueNotice);
    expect(out).not.toContain("past due");
  });

  it("a card subscriber sees Stripe's routes and no PayPal button", () => {
    const out = renderClient();
    expect(out).toContain("Cancel subscription");
    expect(out).toContain(en.common.manageBilling);
    expect(out).not.toContain(en.common.payWithPayPal);
    expect(out).not.toContain(en.common.manageInPayPal);
    // Manage billing appears once, not twice.
    expect(out.split(en.common.manageBilling).length - 1).toBe(1);
    expect(out).toContain(en.billing.billedByCard);
  });

  it("a card row stored as inactive keeps Cancel and says it must be settled, offering no checkout the server refuses", () => {
    const inactive = sub({ status: "inactive" });
    const out = renderClient({
      subscription: inactive,
      entitled: false,
      websiteSubscriptions: [{ ...inactive, websiteId: "site_a", domain: "alpha.example" }],
    });
    expect(out).toContain("Cancel subscription");
    expect(out).toContain(en.billing.unsettledNotice.replace("'", "&#x27;"));
    expect(out).toContain(en.billing.noPlanChange);
    expect(out).not.toContain(en.billing.payByCard);
    expect(out).not.toContain(en.common.payWithPayPal);
  });

  it("a card subscription already set to end says when PayPal opens, not to cancel it again", () => {
    const ending = sub({ cancelAtPeriodEnd: true });
    const props = {
      subscription: ending,
      websiteSubscriptions: [{ ...ending, websiteId: "site_a", domain: "alpha.example" }],
    };
    const out = renderClient(props);
    expect(out).not.toContain("Cancel subscription");
    expect(out).not.toContain(en.billing.billedByCard);
    // The same date the page shows for the period end.
    expect(out).toContain("card subscription ends on 3 Nov 2026. You can choose PayPal once it has ended.");
    expect(out).toContain(">3 Nov 2026<");

    const german = plain(renderClient({ ...props, t: de.billing, tCommon: de.common, locale: "de" }));
    expect(german).toContain("Das Kartenabonnement dieser Website endet am 3. Nov. 2026.");
    expect(german).not.toContain(de.billing.billedByCard);

    // No period end to name: no PayPal advice rather than a stale one.
    const undated = sub({ cancelAtPeriodEnd: true, currentPeriodEnd: null });
    const noDate = renderClient({
      subscription: undated,
      websiteSubscriptions: [{ ...undated, websiteId: "site_a", domain: "alpha.example" }],
    });
    expect(noDate).not.toContain(en.billing.billedByCard);
    expect(noDate).not.toContain("card subscription ends on");
  });

  it("a PayPal subscription cancelled in PayPal says until when it runs, and offers no plan change (review M1)", () => {
    const ending = sub({ provider: "paypal", hasCustomer: false, cancelAtPeriodEnd: true });
    const out = renderClient({ subscription: ending, websiteSubscriptions: [{ ...ending, websiteId: "site_a", domain: "alpha.example" }] });
    expect(out).toContain("PayPal subscription is cancelled and its plan runs until 3 Nov 2026. You can choose a plan again, by card or PayPal, once it has ended.");
    expect(out).not.toContain(en.billing.billedByPayPal);
    expect(out).not.toContain(en.common.payWithPayPal);
    expect(out).not.toContain(en.billing.payByCard);
    expect(out).toContain(en.common.manageInPayPal);

    const german = plain(renderClient({ subscription: ending, websiteSubscriptions: [{ ...ending, websiteId: "site_a", domain: "alpha.example" }], t: de.billing, tCommon: de.common, locale: "de" }));
    expect(german).toContain("Das PayPal-Abonnement dieser Website ist gekündigt, ihr Tarif läuft noch bis zum 3. Nov. 2026.");
  });

  it("a PayPal subscriber sees PayPal's route and no card or Stripe buttons", () => {
    const paypal = sub({ provider: "paypal", hasCustomer: true });
    const out = renderClient({
      subscription: paypal,
      websiteSubscriptions: [{ ...paypal, websiteId: "site_a", domain: "alpha.example" }],
    });
    expect(out).toContain(en.common.manageInPayPal);
    expect(out).not.toContain("Cancel subscription");
    expect(out).not.toContain(en.common.manageBilling);
    // The other plan can be moved to, through PayPal only.
    expect(planMethods(SCALE, paymentOptions(paypal, true), paypal)).toEqual(["paypal"]);
    expect(out.split(en.billing.switchPlan).length - 1).toBe(1);
  });

  it("shows no PayPal button on a plan that is not in PayPal", () => {
    const out = renderClient({
      plans: [GROW, { ...SCALE, paypalPlanId: null }],
      subscription: null,
      entitled: false,
      websiteSubscriptions: [],
    });
    // Both can be chosen; only Grow offers PayPal in its dialog.
    expect(out).toContain("Choose Grow");
    expect(out).toContain("Choose Scale");
    const options = paymentOptions(null, true);
    expect(planMethods(GROW, options, null)).toEqual(["card", "paypal"]);
    expect(planMethods({ ...SCALE, paypalPlanId: null }, options, null)).toEqual(["card"]);
    // PayPal not configured: card only, everywhere.
    expect(planMethods(GROW, paymentOptions(null, false), null)).toEqual(["card"]);
  });

  it("is fully translated: German labels, prices and periods", () => {
    const out = plain(
      renderClient({ t: de.billing, tCommon: de.common, locale: "de", subscription: null, entitled: false, websiteSubscriptions: [] }),
    );
    expect(out).toContain("99 €");
    expect(out).toContain("/ Monat");
    expect(out).toContain("Grow wählen");
    expect(out).toContain(BILLING_PLANS_COPY.de.title);
    for (const english of ["Choose Grow", "Switch to this plan", "Plan highlights", " / month", "Opening", "Cancel subscription"]) {
      expect(out).not.toContain(english);
    }
  });

  it("without a website it points at adding one", () => {
    const out = renderClient({ websiteId: null, subscription: null, entitled: false, websiteSubscriptions: [] });
    expect(out).toContain(en.billing.addWebsiteFirst);
    expect(out).toContain('href="/websites/new"');
  });

  it("says when the header's website is a shared one billed by its owner", () => {
    const out = renderClient({ viewingSharedDomain: "shared.example" });
    expect(out).toContain("shared.example is shared with you, and its owner pays for it.");
  });

  it("links each other website to its own plan", () => {
    const a: WebsiteSubscription = { ...sub(), websiteId: "site_a", domain: "alpha.example" };
    const b: WebsiteSubscription = { ...sub({ planId: null, planName: null, status: "inactive" }), websiteId: "site_b", domain: "beta.example" };
    const out = renderClient({ websiteSubscriptions: [a, b] });
    expect(out).toContain('href="/billing?site=site_b#plan"');
    expect(out).not.toContain('href="/billing?site=site_a#plan"');
    expect(out).toContain(BILLING_PLANS_COPY.en.shownAbove);
  });
});

describe("PaymentsPanel", () => {
  const row = (overrides: Partial<PaymentRow>): PaymentRow => ({
    id: Math.random().toString(36),
    provider: "stripe",
    amountCents: 9900,
    currency: "eur",
    status: "paid",
    invoiceUrl: null,
    description: "Grow",
    paidAt: new Date(Date.UTC(2026, 8, 30, 23, 30)),
    ...overrides,
  });

  it("marks a refund and points each receipt at the right place", () => {
    const out = html(
      createElement(PaymentsPanel, {
        payments: [
          row({ status: "refunded", invoiceUrl: "https://stripe.test/inv" }),
          row({ provider: "paypal" }),
          row({}),
        ],
        portal: "page",
        t: en.common,
        tBilling: en.billing,
        tStatus: en.status,
        locale: "en",
      }),
    );
    expect(out).toContain("Refunded");
    expect(out).toContain(en.common.receiptInPayPal);
    expect(out).toContain(en.billing.invoiceInPortal);
    // The plan section carries Manage billing; the history does not repeat the button.
    expect(out).not.toContain("<button");
    // The date is the stored day in UTC, whatever the server's zone.
    expect(out).toContain("30 Sept 2026");
  });

  it("offers Manage billing itself when the plan section does not, so the row's pointer leads somewhere", () => {
    const panel = (portal: "here" | "none", payments: PaymentRow[]) =>
      html(
        createElement(PaymentsPanel, { payments, portal, t: en.common, tBilling: en.billing, tStatus: en.status, locale: "en" }),
      );
    const button = new RegExp(`<button[^>]*>(?:(?!</button>).)*${en.common.manageBilling}`);
    const here = panel("here", [row({})]);
    expect(here).toMatch(button);
    expect(here).toContain(en.billing.invoiceInPortal);
    // Every row has its invoice: nothing to point at, no extra button.
    expect(panel("here", [row({ invoiceUrl: "https://stripe.test/inv" })])).not.toContain("<button");
    // No Stripe customer: no portal, so no sentence sending people to one.
    const none = panel("none", [row({})]);
    expect(none).not.toContain(en.billing.invoiceInPortal);
    expect(none).not.toContain("<button");
  });

  it("shows nothing when nothing has been charged", () => {
    expect(
      html(createElement(PaymentsPanel, { payments: [], portal: "page", t: en.common, tBilling: en.billing, tStatus: en.status, locale: "en" })),
    ).toBe("");
  });

});
