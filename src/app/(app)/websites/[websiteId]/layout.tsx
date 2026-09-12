import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
            !analysed ? <StatusBadge status={site.status} /> : null
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

      {/*
        No sub-navigation here. The sections are top-level items in the main
        sidebar, so a second column repeating them would be two navigations
        competing for the same job.
      */}
      <div className="space-y-6">{children}</div>
    </PageShell>
  );
}
