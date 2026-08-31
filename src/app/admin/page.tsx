import { getPlatformStats } from "@/lib/admin/actions";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminOverviewPage() {
  const stats = await getPlatformStats();

  /**
   * Revenue is monthly recurring from entitled subscriptions; cost is what
   * providers charged this month. Shown side by side because the gap between
   * them is the only number that says whether the business works.
   */
  const tiles = [
    { label: "Organizations", value: stats.organizations.toLocaleString() },
    { label: "Users", value: stats.users.toLocaleString() },
    { label: "Websites", value: stats.websites.toLocaleString() },
    { label: "Articles", value: stats.articles.toLocaleString() },
    { label: "Published", value: stats.publishedArticles.toLocaleString() },
    { label: "Paying", value: stats.activeSubscriptions.toLocaleString() },
    { label: "MRR", value: money(stats.monthlyRevenueCents) },
    {
      label: "Provider cost (month)",
      value: `$${stats.providerCostUsd.toFixed(2)}`,
    },
  ];

  return (
    <PageShell width="default">
      <PageHeader
        title="Overview"
        description="Everything on the platform, across all customers."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardTitle className="text-2xl tabular-nums">
                {tile.value}
              </CardTitle>
              <CardDescription>{tile.label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
