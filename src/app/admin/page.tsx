import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { getPlatformStats } from "@/lib/admin/actions";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Platform totals.
 *
 * Every tile that counts rows links to the page listing those rows. They were
 * dead cards before: an operator who read "3 articles" and wanted to see which
 * three had to work out for themselves that Articles was the place to look.
 *
 * Tiles with no list behind them — money, provider cost — deliberately do not
 * link. A card that looks clickable and does nothing is worse than one that
 * plainly does not, so the difference is visible rather than only functional.
 */
export default async function AdminOverviewPage() {
  const stats = await getPlatformStats();

  const tiles: {
    label: string;
    value: string;
    href?: string;
    /** Why this number is what it is, where that is not obvious. */
    hint?: string;
  }[] = [
    {
      label: "Organizations",
      value: stats.organizations.toLocaleString(),
      href: "/admin/organizations",
    },
    {
      label: "Users",
      value: stats.users.toLocaleString(),
      href: "/admin/users",
      hint: "People with an account",
    },
    {
      label: "Websites",
      value: stats.websites.toLocaleString(),
      href: "/admin/organizations",
    },
    {
      label: "Articles",
      value: stats.articles.toLocaleString(),
      href: "/admin/articles",
    },
    {
      label: "Published",
      value: stats.publishedArticles.toLocaleString(),
      href: "/admin/articles?status=published",
    },
    {
      label: "Paying",
      value: stats.activeSubscriptions.toLocaleString(),
      href: "/admin/payments",
    },
    {
      label: "MRR",
      value: money(stats.monthlyRevenueCents),
      href: "/admin/payments",
      hint: "Active subscriptions only",
    },
    {
      /**
       * No list behind this one: it is a sum of usage events, not a set of
       * records an operator acts on.
       */
      label: "Provider cost (month)",
      value: `$${stats.providerCostUsd.toFixed(2)}`,
      hint: "AI and SEO providers, this month",
    },
  ];

  return (
    <PageShell width="default">
      <PageHeader
        title="Overview"
        description="Everything on the platform, across all customers."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <CardHeader className="gap-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {tile.value}
                </span>
                {tile.href ? (
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover/card:text-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <span className="text-sm text-muted-foreground">
                {tile.label}
              </span>
              {tile.hint ? (
                <span className="text-xs text-muted-foreground/80">
                  {tile.hint}
                </span>
              ) : null}
            </CardHeader>
          );

          if (!tile.href) {
            return <Card key={tile.label}>{body}</Card>;
          }

          return (
            <Card
              key={tile.label}
              className={cn(
                "transition-colors hover:border-foreground/20",
                // Keyboard focus has to be visible on the card, not just the
                // link inside it, or tabbing through eight tiles shows nothing.
                "focus-within:ring-2 focus-within:ring-ring/50",
              )}
            >
              <Link
                href={tile.href}
                // Stretched over the whole card so the number itself is the
                // target, while the accessible name stays a real sentence.
                className="outline-none"
                aria-label={`${tile.label}: ${tile.value}`}
              >
                {body}
              </Link>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
