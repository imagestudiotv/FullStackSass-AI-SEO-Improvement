import { COMPANY_NAME, SUPPORT_EMAIL, hasRealSupportEmail } from "@/lib/config/site";

/**
 * Who RepGet is, as structured data: one WebSite and one Organization, linked.
 *
 * Rendered once, on the homepage - the canonical page for both entities -
 * rather than on every page, since repeating them site-wide adds no signal and
 * risks describing sub-pages as the organisation itself.
 *
 * WEBSITE is what Google reads first to decide the SITE NAME shown above a
 * search result ("RepGet" rather than "repget.com"); alternateName offers the
 * domain form as a second choice. It names the Organization as its publisher.
 *
 * ORGANIZATION carries the logo and, once real, the support contact.
 *
 * Both have stable @ids on the canonical host (client's launch review,
 * 2026-10-03), so other structured data - a blog post's publisher, a future
 * SoftwareApplication - can point at them instead of repeating them.
 *
 * Every field comes from real configuration. The support address is included
 * only once it is a real one: `hasRealSupportEmail()` is false while the
 * placeholder is in place, and publishing "support@example.com" as structured
 * contact data would be worse than publishing nothing. Social profiles
 * (`sameAs`) are left out until the brand has some.
 */

/** The domain as people write it, offered to Google as the site's second name. */
const ALTERNATE_NAME = "RepGet.com";

/**
 * The square R mark, 512x512. Google asks for a logo at least 112px that reads
 * on a white background; the wide wordmark is a worse fit for the square slot
 * search results use.
 */
const LOGO = { path: "/icon-512.png", width: 512, height: 512 };

export function siteSchema(siteUrl: string): Record<string, unknown> {
  const site = siteUrl.replace(/\/+$/, "");
  const organizationId = `${site}/#organization`;

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
    "@id": `${site}/#website`,
    url: `${site}/`,
    name: COMPANY_NAME,
    alternateName: ALTERNATE_NAME,
    publisher: { "@id": organizationId },
  };

  return { "@context": "https://schema.org", "@graph": [website, organization] };
}

export function OrganizationSchema({ siteUrl }: { siteUrl: string }) {
  return (
    <script
      type="application/ld+json"
      // Serialised from our own configuration, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema(siteUrl)) }}
    />
  );
}
