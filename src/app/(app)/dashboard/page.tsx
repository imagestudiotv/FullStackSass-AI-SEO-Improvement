import { ArrowRight, Globe, Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth-guard";
import { listWebsites } from "@/lib/websites/actions";

export const metadata = { title: "Dashboard" };

// Reads the caller's websites, so it is per-request by definition.
export const dynamic = "force-dynamic";

/**
 * Plain-language status for each website, in the customer's terms.
 *
 * The stored values are internal ("crawling", "researching"); a small-business
 * owner should read what the product is doing for them, not our job names.
 */
const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Waiting to start", variant: "secondary" },
  crawling: { label: "Reading your site", variant: "secondary" },
  researching: { label: "Finding opportunities", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  failed: { label: "Needs attention", variant: "destructive" },
};

export default async function DashboardPage() {
  const session = await requireSession();
  const firstName = session.user.name?.split(" ")[0] || session.user.email;

  const websites = await listWebsites();

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          websites.length === 0
            ? "Add your website and we will start finding the search terms your customers actually use."
            : "Here is what we are working on for your business."
        }
        actions={
          websites.length > 0 ? (
            <Button asChild size="sm">
              <Link href="/websites">
                <Plus className="size-4" />
                Add website
              </Link>
            </Button>
          ) : null
        }
      />

      {websites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No website connected yet"
          description="Once you add your website we read it, work out what your business does, and find the search terms worth going after."
          action={
            <Button asChild>
              <Link href="/websites">
                Add your website
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {websites.map((site) => {
            const status = STATUS[site.status] ?? {
              label: site.status,
              variant: "secondary" as const,
            };
            return (
              <Card key={site.id} className="transition-colors hover:border-foreground/20">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/websites/${site.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {site.brandName || site.domain}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {site.domain}
                      {site.industry ? ` · ${site.industry}` : ""}
                    </p>
                  </div>
                  <Badge variant={status.variant} className="shrink-0">
                    {status.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
