import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { WebsiteNav } from "@/components/website-nav";
import { requireSession } from "@/lib/auth-guard";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";

/**
 * Shell for one website's area.
 *
 * The header and sub-navigation live here so every section renders only its
 * own panel. Previously all eight panels shared one page, which meant a visit
 * to any of them loaded the data for all eight — an audit, keyword research,
 * analytics, decay detection, AI visibility, the backlink network, publishing
 * integrations and the profile.
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

  const analysed = site.status === "ready";

  return (
    <PageShell>
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/websites">
            <ArrowLeft className="size-4" />
            All websites
          </Link>
        </Button>

        <PageHeader
          title={site.brandName || site.domain}
          actions={
            !analysed ? (
              <Badge variant="secondary">Still setting up</Badge>
            ) : null
          }
        />

        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          {site.domain}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <WebsiteNav websiteId={site.id} />
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </PageShell>
  );
}
