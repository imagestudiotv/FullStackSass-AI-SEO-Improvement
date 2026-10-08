import type { Metadata } from "next";

import { listPlansForPrebuiltPage } from "@/lib/billing";
import { HomePageSections } from "./home-page";
import { OrganizationSchema } from "./organization-schema";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

/**
 * Marketing homepage, following the supplied landing design.
 *
 * Renders the same sections as the localised versions, from the same
 * composition — see home-page.tsx. English keeps unprefixed paths, so its
 * href builder returns the path unchanged.
 */

/**
 * Built ahead and refreshed in the background at most hourly, instead of on
 * every visit (client's launch review, 2026-10-03: mobile PageSpeed). Plan
 * prices are the only data here and change rarely; serving a ready-made page
 * from Vercel's edge cuts the server response time PageSpeed weighs heavily.
 * See listPlansForPrebuiltPage for how a build without a database, and a
 * database that fails, are each handled.
 */
export const revalidate = 3600;

/**
 * The homepage's own title, description, canonical and og:url.
 *
 * It had none, so it inherited the root layout's: the title was the bare
 * word "RepGet" and the description an old one-liner - which is what Google
 * showed for the site's most important page. Wording from the client's launch
 * review (2026-10-03).
 *
 * `absolute` because the root layout's template appends "| RepGet" to every
 * title, and this one already ends with it.
 */
export const metadata: Metadata = {
  title: { absolute: "AI SEO Platform for Content & Backlinks | RepGet" },
  description:
    "Automate SEO with RepGet. Research keywords, publish optimized content, build quality backlinks, track rankings and improve visibility in Google and AI search.",
  ...publicPageMetadata("/"),
};

export default async function HomePage() {
  const plans = await listPlansForPrebuiltPage();
  // English is unprefixed; the localised pages pass a prefixing builder.
  const href = (path: string) => path;

  /**
   * Matches the metadataBase in the root layout, which falls back to the
   * production domain rather than localhost so a missing variable cannot
   * publish structured data pointing at a developer machine.
   */
  const siteUrl = canonicalSiteUrl();

  return (
    <>
      <OrganizationSchema siteUrl={siteUrl} plans={plans} />
      <HomePageSections locale="en" href={href} plans={plans} />
    </>
  );
}
