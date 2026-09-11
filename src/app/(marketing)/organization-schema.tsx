import { COMPANY_NAME, SUPPORT_EMAIL, hasRealSupportEmail } from "@/lib/config/site";

/**
 * Organization structured data for the site.
 *
 * Rendered once on the homepage — the canonical page for the entity — rather
 * than on every page, since repeating it site-wide adds no signal and risks
 * describing sub-pages as the organisation itself.
 *
 * Every field comes from real configuration. The support address is included
 * only once it is a real one: `hasRealSupportEmail()` is false while the
 * placeholder is in place, and publishing "support@example.com" as structured
 * contact data would be worse than publishing nothing.
 */
export function OrganizationSchema({ siteUrl }: { siteUrl: string }) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: COMPANY_NAME,
    url: siteUrl,
  };

  if (hasRealSupportEmail()) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT_EMAIL,
    };
  }

  return (
    <script
      type="application/ld+json"
      // Serialised from our own configuration, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
