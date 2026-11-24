import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The credit packs' page (Daniel, 2026-11-24): the packs first, every figure
 * from the add-on rows, PayPal only where it can complete, the small top-up
 * only while it can be bought, and the other add-ons under them. Static
 * markup; the checkouts are stubs, and their rules are tested on the server's
 * side.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/addons/actions", () => ({ buyAddon: vi.fn(), buyAddonWithCredits: vi.fn(), buyAddonWithPayPal: vi.fn() }));

import { PurchasesPanel } from "@/components/billing/purchases-panel";
import type { AddonRow, PurchaseRow } from "@/lib/addons/shared";
import { packViews, TOP_UP_PACK_SLUG } from "@/lib/credits/buy-credits";
import { BUY_CREDITS_COPY, PAYMENT_CHOICE_COPY } from "@/lib/i18n/buy-credits";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

import { CreditPacks, PackCheckoutView, packMethods, type AddonReturn } from "./credit-packs";
import { ServicesPanel } from "./services-panel";

const en = getMessages("en").app;
const html = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);
/** Intl puts a no-break space between "99" and "€" in German; compare on plain spaces. */
const plain = (value: string) => value.replace(/[  ]/g, " ");

const pack = (slug: string, credits: number, cents: number, purchasable = true): AddonRow => ({
  id: `id_${slug}`,
  slug,
  name: `${credits} credits`,
  description: null,
  priceCents: cents,
  currency: "eur",
  creditsGranted: credits,
  kind: "credits",
  creditPrice: null,
  purchasable,
});
const PACKS = [pack("credits_10", 100, 7900), pack("credits_25", 250, 14900), pack("credits_50", 500, 27900)];
const TOP_UP = pack(TOP_UP_PACK_SLUG, 50, 4900);

const service = (kind: "service" | "quote", creditPrice: number | null): AddonRow => ({
  id: kind,
  slug: kind,
  name: kind === "service" ? "Top 250 live USA Local Citations" : "We fix the errors for you",
  description: null,
  priceCents: 19900,
  currency: "eur",
  creditsGranted: 0,
  kind,
  creditPrice,
  // A service may still carry a Stripe price from when it was sold by card; it is not used.
  purchasable: true,
});

function packs(addons: AddonRow[], options: { paypal?: boolean; result?: AddonReturn; locale?: Locale } = {}) {
  const locale = options.locale ?? "en";
  const app = getMessages(locale).app;
  return plain(
    html(
      createElement(CreditPacks, {
        addons,
        paypalAvailable: options.paypal ?? false,
        result: options.result ?? null,
        resultCopy: { success: "RECEIVED", cancelled: "CANCELLED", pending: "PENDING", failed: "FAILED" },
        copy: BUY_CREDITS_COPY[locale],
        choice: PAYMENT_CHOICE_COPY[locale],
        locale,
        tAddons: app.addons,
        mostPopular: app.common.mostPopular,
      }),
    ),
  );
}

describe("the figures", () => {
  it("are worked out from the rows: per credit, and the saving against the smallest card", () => {
    const { cards, topUp } = packViews([...PACKS].reverse());
    expect(cards.map((card) => card.addon.creditsGranted)).toEqual([100, 250, 500]);
    expect(cards.map((card) => card.perCreditCents)).toEqual([79, 60, 56]);
    expect(cards.map((card) => card.savePercent)).toEqual([0, 25, 29]);
    expect(cards.map((card) => card.lowest)).toEqual([false, false, true]);
    expect(cards.map((card) => card.featured)).toEqual([false, true, false]);
    expect(topUp).toBeNull();
  });

  it("claim no saving where there is none", () => {
    const { cards } = packViews([pack("a", 100, 7900), pack("b", 200, 15800), pack("c", 300, 24000)]);
    expect(cards.map((card) => card.savePercent)).toEqual([0, 0, 0]);
    expect(cards.some((card) => card.lowest)).toBe(false);
  });

  it("keep the small top-up out of the cards, and out of the saving", () => {
    const { cards, topUp } = packViews([TOP_UP, ...PACKS]);
    expect(cards).toEqual(packViews(PACKS).cards);
    expect(topUp?.creditsGranted).toBe(50);
    // Not on sale by card yet: absent, rather than a line that cannot be bought.
    expect(packViews([{ ...TOP_UP, purchasable: false }, ...PACKS]).topUp).toBeNull();
  });

  it("the top-up's slug is the seed's, at the client's price", () => {
    const seed = readFileSync(join(process.cwd(), "scripts/seed-addons.mjs"), "utf8").replace(/\r\n/g, "\n");
    expect(seed).toMatch(new RegExp(`slug: "${TOP_UP_PACK_SLUG}",[^}]*priceCents: 4900,\\s*creditsGranted: 50,\\s*kind: "credits"`));
  });
});

describe("the packs", () => {
  it("are cards with type, credits, price, price per credit and saving, the middle one most popular", () => {
    const out = packs(PACKS);
    expect(out).toContain('id="credit-packs"');
    for (const word of ["Starter", "Growth", "Scale", "€79", "€149", "€279", "€0.79 per credit", "€0.60 per credit", "€0.56 per credit", "Save 25%", "Save 29%", "Buy 100 credits", "Buy 250 credits", "Buy 500 credits"]) {
      expect(out).toContain(word);
    }
    expect(out.split(en.common.mostPopular).length - 1).toBe(1);
    expect(out).toMatch(/data-pack="credits_25"[^>]*>[^<]*<span[^>]*>Most popular/);
    for (const benefit of BUY_CREDITS_COPY.en.benefits) expect(out).toContain(benefit);
  });

  it("offer PayPal only where it can complete a purchase", () => {
    expect(packs(PACKS)).toContain(BUY_CREDITS_COPY.en.cardOnly);
    expect(packs(PACKS)).not.toContain("PayPal");
    expect(packs(PACKS, { paypal: true })).toContain(BUY_CREDITS_COPY.en.cardOrPayPal);
    expect(packMethods(PACKS[0], true)).toEqual(["card", "paypal"]);
    expect(packMethods(PACKS[0], false)).toEqual(["card"]);
    expect(packMethods({ ...PACKS[0], purchasable: false }, false)).toEqual([]);
  });

  it("nobody can pay for say so", () => {
    const out = packs(PACKS.map((row) => ({ ...row, purchasable: false })));
    expect(out.split(`disabled=""`).length - 1).toBe(3);
    expect(out.split(en.addons.unavailable).length - 1).toBe(3);
  });

  it("show the small top-up as a line only while it is on sale", () => {
    expect(packs([...PACKS, TOP_UP])).toContain("50 credits for €49.");
    expect(packs([...PACKS, TOP_UP])).toContain("Get 50 credits");
    expect(packs(PACKS)).not.toContain("Need a smaller top-up?");
    expect(packs([...PACKS, { ...TOP_UP, purchasable: false }])).not.toContain("Need a smaller top-up?");
  });

  it("say what came of a payment, and nothing otherwise", () => {
    expect(packs(PACKS, { result: "success" })).toContain("RECEIVED");
    expect(packs(PACKS, { result: "pending" })).toContain("PENDING");
    expect(packs(PACKS, { result: "cancelled" })).toContain("CANCELLED");
    expect(packs(PACKS, { result: "failed" })).toContain("FAILED");
    expect(packs(PACKS)).not.toMatch(/RECEIVED|PENDING|CANCELLED|FAILED/);
  });

  it("are in the reader's language", () => {
    const out = packs([...PACKS, TOP_UP], { locale: "de", paypal: true });
    expect(out).toContain("0,60 € pro Credit");
    expect(out).toContain("25 % sparen");
    for (const english of ["per credit", "Buy ", "Save ", "Most popular", "Card or PayPal", "How do"]) expect(out).not.toContain(english);
  });

  it("have every word in every language", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(BUY_CREDITS_COPY[locale])).toEqual(Object.keys(BUY_CREDITS_COPY.en));
      expect(Object.keys(PAYMENT_CHOICE_COPY[locale])).toEqual(Object.keys(PAYMENT_CHOICE_COPY.en));
      expect(JSON.stringify(BUY_CREDITS_COPY[locale])).not.toContain("—");
      for (const field of ["save", "topUpOffer", "topUpButton", "balance"] as const) {
        const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
        expect(names(BUY_CREDITS_COPY[locale][field])).toEqual(names(BUY_CREDITS_COPY.en[field]));
      }
    }
  });
});

describe("the checkout dialog", () => {
  const dialog = (methods: ("card" | "paypal")[], method: "card" | "paypal", pending = false) =>
    html(
      createElement(PackCheckoutView, {
        title: null,
        description: null,
        pack: PACKS[1],
        methods,
        method,
        onMethod: () => {},
        pending,
        onPay: () => {},
        copy: BUY_CREDITS_COPY.en,
        choice: PAYMENT_CHOICE_COPY.en,
        locale: "en",
      }),
    );

  it("sums up the order and asks how to pay", () => {
    const out = dialog(["card", "paypal"], "card");
    expect(out).toContain("250 credits");
    expect(out).toContain("€149");
    expect(out.split('type="radio"').length - 1).toBe(2);
    expect(out).toContain("Continue with card");
    expect(dialog(["card", "paypal"], "paypal")).toContain("Continue with PayPal");
    expect(dialog(["card"], "card")).not.toContain("PayPal");
    // While the payment is being started, nothing can be pressed twice.
    expect(dialog(["card"], "card", true)).toMatch(/<button[^>]*disabled=""[^>]*>/);
  });
});

describe("the other add-ons", () => {
  const services = (addons: AddonRow[], locale: Locale = "en") => {
    const app = getMessages(locale).app;
    return plain(html(createElement(ServicesPanel, { addons, t: app.addons, tCredits: app.credits })));
  };

  it("sells services for credits, not money, and a quote from a price in credits", () => {
    const out = services([...PACKS, service("service", 250), service("quote", 190)]);
    expect(out).toContain('id="services"');
    expect(out).toContain(en.addons.servicesHelp);
    // The service's price is in credits; its old card price is nowhere.
    expect(out).toContain("250 credits");
    expect(out).not.toContain("199");
    expect(out).toContain("From 190 credits.");
    expect(out).not.toContain("Buy 100 credits");
  });

  it("offers no Buy button for a service without a price in credits", () => {
    expect(services([service("service", null)], "it")).toMatch(/<button[^>]*disabled[^>]*>Non disponibile<\/button>/);
  });

  it("shows nothing when there are none", () => {
    expect(services(PACKS)).toBe("");
  });
});

describe("what was bought", () => {
  const purchase: PurchaseRow = {
    id: "p1",
    slug: "credits_10",
    name: "10 credits",
    kind: "credits",
    pricePaidCents: 4900,
    currency: "eur",
    creditsPaid: null,
    status: "paid",
    fulfilledAt: null,
    createdAt: new Date(Date.UTC(2026, 8, 1)),
  };
  const panel = (purchases: PurchaseRow[]) =>
    html(createElement(PurchasesPanel, { purchases, locale: "en", t: en.addons, tCredits: en.credits }));

  it("lists each purchase by its date and what it was paid with", () => {
    const out = panel([
      purchase,
      { ...purchase, id: "p2", name: "Top 250 live USA Local Citations", kind: "service", pricePaidCents: 0, creditsPaid: 250 },
    ]);
    expect(out).toContain(en.addons.yourPurchases);
    expect(out).toContain("1 Sept 2026");
    expect(out).toContain("€49");
    expect(out).toMatch(/<span class="tabular-nums">250 credits<\/span>/);
    expect(out).toContain(en.addons.inProgress);
    expect(panel([])).toBe("");
  });
});

describe("every Buy credits link", () => {
  it("leads to the packs: no source links the old Billing anchor any more", () => {
    const left: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && /["'`]\/billing#addons/.test(readFileSync(path, "utf8"))) left.push(path);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(left).toEqual([]);
  });
});
