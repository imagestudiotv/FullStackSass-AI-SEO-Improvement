import { notFound } from "next/navigation";

import { SettingsNav } from "@/components/settings-nav";
import { PageShell } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth-guard";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";

/**
 * Shell for one website's area.
 *
 * The header lives here and the section links live in the main sidebar, so
 * every section renders only its own panel. All eight previously shared one
 * page, which meant a visit to any of them loaded the data for all eight — an
 * audit, keyword research, analytics, decay detection, AI visibility, the
 * backlink network, publishing integrations and the profile.
 *
 * The website is resolved here as well, so a bad id 404s once rather than in
 * each of eight pages.
 */
export default async function WebsiteLayout({
  children,
  params,
}: LayoutProps<"/websites/[websiteId]">) {
  await requireSession();
  const { websiteId } = await params;

  let site;
  try {
    ({ site } = await requireWebsite(websiteId));
  } catch (error) {
    // Another tenant's id is a 404, not a 403: confirming the id exists would
    // tell a stranger which websites we host.
    if (error instanceof WebsiteNotFoundError) notFound();
    throw error;
  }

  return (
    <PageShell width="wide">
      {/*
        NO NAME, NO DOMAIN, NO BACK LINK.

        All three were removed at the client's request: "We move business
        details part all up once we delete all this unecessary, we have
        already on dashboar left image studio written". He is right — the
        website switcher in the top bar names the site on every page, so the
        heading repeated it, the domain repeated it again, and "All websites"
        duplicated a sidebar the switcher already replaces. Three rows of
        chrome pushed the first editable field below the fold.

        The status badge went with them. It only ever appeared while a site
        was still being analysed, and that state now has its own screens in
        onboarding; a badge that is invisible in the normal case is not worth
        a row that is always there.
      */}
      <SettingsNav websiteId={site.id} />

      <div className="space-y-6">{children}</div>
    </PageShell>
  );
}
