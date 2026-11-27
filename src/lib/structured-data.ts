import type { PlanRow } from "@/lib/billing-shared";
import { planDisplayPrice } from "@/lib/billing/display-prices";
import { COMPANY_NAME } from "@/lib/config/site";

/**
 * schema.org building blocks shared by the marketing pages (client's launch
 * review, 2026-10-03: "SoftwareApplication, Article, BreadcrumbList ... on
 * their respective pages").
 *
 * One place for the entity @ids, so every block that refers to RepGet - a blog
 * post's publisher, the app's publisher - points at the SAME node the homepage
 * defines, rather than describing the company again with drifting details.
 */

/** Stable @ids on the canonical host. `site` is siteUrl(), no trailing slash. */
export function entityIds(site: string) {
  const base = site.replace(/\/+$/, "");
  return {
    website: `${base}/#website`,
    organization: `${base}/#organization`,
    software: `${base}/#software`,
  };
}

/**
 * RepGet as a page's author or publisher: the homepage's node by its @id,
 * with its name and address too. A bare {"@id"} is only resolved on the
 * homepage, where that node is defined; on any other page a validator sees
 * an author with no name - a Google rich results validation error on the
 * success stories' Article (Ahrefs site audit, 2026-11-24).
 */
export function organizationRef(site: string): Record<string, string> {
  const base = site.replace(/\/+$/, "");
  return { "@type": "Organization", "@id": entityIds(base).organization, name: COMPANY_NAME, url: `${base}/` };
}

export type Crumb = { name: string; path: string };

/**
 * A BreadcrumbList for a page's trail, Home first.
 *
 * Only for pages that SHOW this trail: Google asks that breadcrumb markup
 * reflect the page's real position, so the names and order here must match
 * the visible <nav aria-label="Breadcrumb"> on the same page.
 */
export function breadcrumbList(site: string, trail: Crumb[]): Record<string, unknown> {
  const base = site.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${base}${crumb.path}`,
    })),
  };
}

/**
 * RepGet as a web application, with the plans the pricing page sells.
 *
 * THE PRICES MUST BE THE ONES THE PAGE SHOWS. The pricing page and the
 * homepage preview list the active MONTHLY plans, each "€N / month"
 * (app/(marketing)/pricing/page.tsx); this takes the same plans through the
 * same filter, so structured data can never quote a price a visitor cannot
 * find. Annual plans are not shown as prices anywhere, so they are not offered
 * here either.
 *
 * No aggregateRating or review: there are no published customer reviews to
 * back one, and invented ratings are against Google's rules. Without them
 * Google does not show the software rich result, but still reads the data.
 */
export function softwareApplication(site: string, plans: PlanRow[], offer = false): Record<string, unknown> {
  const base = site.replace(/\/+$/, "");
  const ids = entityIds(base);
  const monthly = plans.filter((plan) => plan.interval === "month");

  const app: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    "@id": ids.software,
    name: COMPANY_NAME,
    url: `${base}/`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    publisher: { "@id": ids.organization },
  };

  if (monthly.length > 0) {
    app.offers = monthly.map((plan) => {
      // The price charged, as the cards show it: the REPGET launch price while it is on (lib/billing/display-prices.ts).
      const price = planDisplayPrice(plan, offer).chargedCents / 100;
      const priceCurrency = plan.currency.toUpperCase();
      return {
        "@type": "Offer",
        name: plan.name,
        price,
        priceCurrency,
        url: `${base}/pricing`,
        // "per month", as the page says it.
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price,
          priceCurrency,
          referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
        },
      };
    });
  }

  return app;
}
