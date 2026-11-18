import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { isPublicEnglishPage } from "@/lib/seo/public-pages";
import { launchFacts, SEO_CONTENT_AUTOMATION_PATH, seoContentAutomationCopy } from "@/lib/marketing/seo-content-automation";
import { signUpForPlan } from "@/lib/plans/features";
import { catalogRows } from "../../../../scripts/plan-catalog.mjs";

/**
 * The English SEO-content landing page (the English Google Ads candidate's
 * destination): not indexed and not in the sitemap, the standard Launch trial
 * as its only offer, the price checkout charges and no other, and none of the
 * claims the product does not back.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
const { listPlans, offerOn } = vi.hoisted(() => ({ listPlans: vi.fn(), offerOn: vi.fn(() => true) }));
vi.mock("@/lib/billing", () => ({ listPlans }));
vi.mock("@/lib/billing/repget-offer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/repget-offer")>()),
  repgetOfferEnabled: offerOn,
}));

import Page, { dynamic, metadata } from "./page";
import { SeoContentAutomationContent } from "./seo-content-automation-page";

/** The catalogue's rows (scripts/plan-catalog.mjs), as listPlans returns them on sale. */
const PLANS = catalogRows().map(
  (row, index) =>
    ({
      id: `${row.tier}_${row.interval}`,
      name: row.name,
      tier: row.tier,
      interval: row.interval,
      currency: "eur",
      priceCents: row.priceCents,
      articleLimit: row.articleLimit,
      socialPostLimit: row.socialPostLimit,
      keywordLimit: row.keywordLimit,
      siteLimit: row.siteLimit,
      monthlyCredits: row.monthlyCredits,
      sortOrder: index,
      isActive: true,
    }) as unknown as PlanRow,
);

const render = async () => renderToStaticMarkup(await Page());
/** The text a visitor reads, without markup. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

beforeEach(() => {
  listPlans.mockResolvedValue(PLANS);
  offerOn.mockReturnValue(true);
});

describe("/seo-content-automation", () => {
  it("names itself as canonical, declares no translations, stays out of search and out of the sitemap", () => {
    expect(metadata).toMatchObject({ robots: { index: false, follow: true } });
    expect(metadata.alternates).toEqual({ canonical: SEO_CONTENT_AUTOMATION_PATH });
    expect(metadata.openGraph?.url).toBe(SEO_CONTENT_AUTOMATION_PATH);
    expect(String(metadata.title)).toMatch(/SEO Content Automation/);
    // Not a PUBLIC_PAGES entry: no sitemap line. /it|de|es|fr/seo-content-automation are its separate versions (seo-content-automation-localized.render.test.ts).
    expect(isPublicEnglishPage(SEO_CONTENT_AUTOMATION_PATH)).toBe(false);
    // The price is read per request, as /pricing reads it.
    expect(dynamic).toBe("force-dynamic");
  });

  it("has one h1 and sends people to the standard Launch trial journey and the pricing page, with no tracking of its own", async () => {
    const html = await render();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const launch = signUpForPlan("launch").replace(/&/g, "&amp;");
    expect(launch).toBe("/sign-up?next=%2Fonboarding%2Fwebsite%3Fplan%3Dlaunch");
    expect(html.split(`href="${launch}"`).length - 1).toBe(2);
    // Every link on the page: the Launch trial, plans, guides and the customer terms. No other plan, no payment link.
    const hrefs = new Set([...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]));
    expect([...hrefs].sort()).toEqual([launch, "/docs/integrations", "/pricing", "/refunds", "/terms"].sort());
    expect(html).not.toMatch(/gclid|utm_|wbraid|gbraid|gtag\(|dataLayer/);
  });

  it("quotes the Launch row's charged price and limits, and no reference price or saving", async () => {
    const page = text(await render());
    // REPGET's launch price is what checkout charges while the offer is on (lib/billing/display-prices.ts).
    expect(page).toContain("€59 a month, billed in euros, after a 3-day free trial");
    expect(page).toContain("30 SEO articles a month");
    expect(page).toContain("300 search terms researched");
    expect(page).toContain("up to 3 articles in the three days");
    expect(page).toContain("When the trial ends, €59 is charged");
    expect(page).not.toMatch(/€99|€299|€49\.17|% off|instead of|was €|regular price|KEEPGROW|a year|per year|yearly|annual/i);
    expect(page).not.toMatch(/\bOFF\b|\bSAVE\b|countdown/);

    offerOn.mockReturnValue(false);
    const regular = text(await render());
    expect(regular).toContain("€99 a month, billed in euros");
    expect(regular).not.toContain("€59");
  });

  it("names no figure when the plan cannot be read, and still offers the trial", () => {
    expect(launchFacts([], true)).toBeNull();
    const page = text(renderToStaticMarkup(createElement(SeoContentAutomationContent, { copy: seoContentAutomationCopy(null) })));
    expect(page).not.toMatch(/€\d/);
    expect(page).toContain("The current price is shown on the pricing page and at checkout");
    expect(page).toContain("Start the Launch trial");
  });

  it("says that publishing is automatic and the first article goes live, next to the workflow", async () => {
    const html = await render();
    const steps = html.indexOf("From research to a published article");
    const notice = html.indexOf("Publishing is automatic unless you change it");
    const connections = html.indexOf("Where RepGet can publish");
    expect(steps).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(steps);
    expect(notice).toBeLessThan(connections);
    const page = text(html);
    expect(page).toContain("first article is published live as soon as it is written");
    expect(page).toContain("Review is not the default");
  });

  it("states the payment method, trial eligibility, renewal, cancellation and the separate refund", async () => {
    const page = text(await render());
    expect(page).toContain("for a new account that has never had a subscription");
    expect(page).toContain("a card, or a PayPal approval");
    expect(page).toContain("then every month until you cancel");
    expect(page).toContain("cancel any time from the billing page");
    expect(page).toContain("email us within 3 days of your first payment");
  });

  it("lists exactly the publishers RepGet has, and makes none of the unsupported claims", async () => {
    const page = text(await render());
    for (const name of ["WordPress plugin", "WordPress (application password)", "Shopify", "Ghost", "Webflow", "Wix", "Custom webhook"]) {
      expect(page).toContain(name);
    }
    expect(page).not.toMatch(/Framer|Squarespace|HubSpot|Notion/);
    expect(page).not.toMatch(/ChatGPT|Gemini|Perplexity|AI search|AI visibility|rank tracking|priority/i);
    expect(page).not.toMatch(/instant|immediately publish|guaranteed (rank|traffic)/i);
    // Images are not promised: the article is written without one when generation fails.
    expect(page).toContain("if it is not, the article is still written");
    // Schema appears only where the page says RepGet does not add it.
    expect(page.match(/schema/gi)).toHaveLength(1);
    expect(page).toContain("Add schema markup (structured data) to your articles.");
  });
});
