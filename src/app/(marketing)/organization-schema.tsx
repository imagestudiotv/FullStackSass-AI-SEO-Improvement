import type { PlanRow } from "@/lib/billing-shared";
import { COMPANY_NAME, SUPPORT_EMAIL, hasRealSupportEmail } from "@/lib/config/site";
import { entityIds, softwareApplication } from "@/lib/structured-data";

/**
 * Who RepGet is, as structured data: one WebSite, one Organization and one
 * SoftwareApplication, linked.
 *
 * Rendered once, on the homepage - the canonical page for both entities -
 * rather than on every page, since repeating them site-wide adds no signal and
 * risks describing sub-pages as the organisation itself.
 *
 * WEBSITE is what Google reads first to decide the SITE NAME shown above a
 * search result ("RepGet" rather than "repget.com"); alternateName offers
 * other choices in order. It names the Organization as its publisher.
 *
 * ORGANIZATION carries the logo and, once real, the support contact.
 *
 * SOFTWAREAPPLICATION describes the product and the plans the pricing page
 * sells, published by the same Organization (lib/structured-data.ts).
 *
 * All three have stable @ids on the canonical host (client's launch review,
 * 2026-10-03; see lib/structured-data.ts), so other structured data - a blog
 * post's publisher - points at them instead of repeating them.
 *
 * Every field comes from real configuration. The support address is included
 * only once it is a real one: `hasRealSupportEmail()` is false while the
 * placeholder is in place, and publishing "support@example.com" as structured
 * contact data would be worse than publishing nothing. Social profiles
 * (`sameAs`) are left out until the brand has some.
 */

/**
 * Other names for the site, in order of preference: the domain as people
 * write it, then the domain in lower case. Google detects the domain as a
 * fallback site name only when it is the LAST alternateName and written in
 * lower case (developers.google.com/search/docs/appearance/site-names). Without
 * a fallback it can pick some other name: results showed "Vercel" (2026-10-09).
 */
const ALTERNATE_NAMES = ["RepGet.com", "repget.com"];

/**
 * The square R mark, 512x512. Google asks for a logo at least 112px that reads
 * on a white background; the wide wordmark is a worse fit for the square slot
 * search results use.
 */
const LOGO = { path: "/icon-512.png", width: 512, height: 512 };

export function siteSchema(
  siteUrl: string,
  /** listPlans(), as the homepage already loads it for its pricing section. */
  plans: PlanRow[] = [],
): Record<string, unknown> {
  const site = siteUrl.replace(/\/+$/, "");
  const ids = entityIds(site);
  const organizationId = ids.organization;

  const organization: Record<string, unknown> = {
    "@type": "Organization",
    "@id": organizationId,
    name: COMPANY_NAME,
    url: `${site}/`,
    logo: {
      "@type": "ImageObject",
      url: `${site}${LOGO.path}`,
      width: LOGO.width,
      height: LOGO.height,
    },
  };

  if (hasRealSupportEmail()) {
    organization.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT_EMAIL,
    };
  }

  const website = {
    "@type": "WebSite",
    "@id": ids.website,
    url: `${site}/`,
    name: COMPANY_NAME,
    alternateName: ALTERNATE_NAMES,
    publisher: { "@id": organizationId },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [website, organization, softwareApplication(site, plans)],
  };
}

export function OrganizationSchema({
  siteUrl,
  plans,
}: {
  siteUrl: string;
  plans: PlanRow[];
}) {
  return (
    <script
      type="application/ld+json"
      // Serialised from our own configuration, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema(siteUrl, plans)) }}
    />
  );
}
