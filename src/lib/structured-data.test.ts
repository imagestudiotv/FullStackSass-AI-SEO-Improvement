import { describe, expect, it } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";

import { breadcrumbList, entityIds, softwareApplication } from "./structured-data";

/**
 * The shared schema.org blocks (client's launch review, 2026-10-03). The price
 * rules matter most: structured data must quote exactly what the pricing page
 * shows - the active monthly plans, per month - and nothing invented.
 */

const SITE = "https://www.repget.com";

/** A plan row with only the fields that matter here set; the rest are filler. */
function plan(over: Partial<PlanRow>): PlanRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Grow",
    tier: "grow",
    interval: "month",
    currency: "eur",
    stripePriceId: null,
    paypalPlanId: null,
    priceCents: 9900,
    articleLimit: 0,
    keywordLimit: 0,
    siteLimit: 0,
    monthlyCredits: 0,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  } as PlanRow;
}

describe("entityIds", () => {
  it("puts every entity on the canonical host, without doubling a slash", () => {
    expect(entityIds(`${SITE}/`)).toEqual({
      website: `${SITE}/#website`,
      organization: `${SITE}/#organization`,
      software: `${SITE}/#software`,
    });
  });
});

describe("breadcrumbList", () => {
  it("numbers the trail from 1, Home first, with absolute addresses", () => {
    expect(
      breadcrumbList(SITE, [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: "Guides", path: "/blog/category/guides" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: "Guides", item: `${SITE}/blog/category/guides` },
      ],
    });
  });
});

describe("softwareApplication", () => {
  const plans = [
    plan({ name: "Grow", tier: "grow", interval: "month", priceCents: 9900 }),
    plan({ name: "Grow (Annual)", tier: "grow", interval: "year", priceCents: 99000 }),
    plan({ name: "Scale", tier: "scale", interval: "month", priceCents: 29900 }),
    plan({ name: "Scale (Annual)", tier: "scale", interval: "year", priceCents: 299000 }),
  ];

  it("describes RepGet as a web app published by the Organization", () => {
    const app = softwareApplication(SITE, plans);
    expect(app).toMatchObject({
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#software`,
      name: "RepGet",
      url: `${SITE}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      publisher: { "@id": `${SITE}/#organization` },
    });
  });

  it("offers exactly the monthly plans the pricing page shows, per month", () => {
    const offers = softwareApplication(SITE, plans).offers as Record<string, unknown>[];

    // Annual plans are not shown as prices anywhere, so they are not offered.
    expect(offers.map((offer) => offer.name)).toEqual(["Grow", "Scale"]);
    expect(offers[0]).toEqual({
      "@type": "Offer",
      name: "Grow",
      price: 99,
      priceCurrency: "EUR",
      url: `${SITE}/pricing`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: 99,
        priceCurrency: "EUR",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
    });
    expect(offers[1].price).toBe(299);
  });

  it("keeps cents exact", () => {
    const [offer] = softwareApplication(SITE, [plan({ priceCents: 4950 })]).offers as {
      price: number;
    }[];
    expect(offer.price).toBe(49.5);
  });

  it("never invents a rating or reviews", () => {
    const app = softwareApplication(SITE, plans);
    expect(app).not.toHaveProperty("aggregateRating");
    expect(app).not.toHaveProperty("review");
  });

  it("omits offers rather than inventing one when no monthly plan is on sale", () => {
    expect(softwareApplication(SITE, [])).not.toHaveProperty("offers");
    expect(
      softwareApplication(SITE, [plan({ interval: "year" })]),
    ).not.toHaveProperty("offers");
  });
});
