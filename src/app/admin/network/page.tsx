import Link from "next/link";

import { getReviewQueue } from "@/lib/admin/network";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * The managed Partner Network's review queue.
 *
 * Every article written for a participating website waits here until an
 * administrator has placed any relevant network links and approved it; no
 * publishing path delivers it before that (lib/articles/review.ts).
 */
export default async function AdminNetworkPage() {
  const queue = await getReviewQueue();
  const pending = queue.articles.filter((a) => !a.approvedCurrent);
  const approved = queue.articles.filter((a) => a.approvedCurrent);
  const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "No date");
  const connection = { cms: "CMS connected", plugin: "WordPress plugin", none: "Not connected" } as const;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Partner Network"
        description="Articles waiting for review, the websites taking part, and each workspace's credits. Open an article to place links and approve it."
        actions={
          <Link href="/admin/network/operations" className="text-sm font-medium underline-offset-4 hover:underline">
            Operations: freeze, review switch, authority, valuation →
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Waiting for review ({pending.length})</CardTitle>
          <CardDescription>
            Held from every publishing path until approved. Oldest planned date first.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is waiting.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-72">
                      <Link href={`/admin/network/${article.id}`} className="font-medium underline-offset-4 hover:underline">
                        {article.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {article.domain}
                      <span className="block text-xs text-muted-foreground">
                        {article.organizationName}
                        {article.language ? ` · ${article.language}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{day(article.plannedFor)}</TableCell>
                    <TableCell>
                      <Badge variant={article.reviewStatus === "approved" ? "destructive" : "secondary"}>
                        {article.reviewStatus === "approved" ? "Changed since approval" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{article.placements}</TableCell>
                    <TableCell className="text-xs">{connection[article.connected]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approved, not yet published ({approved.length})</CardTitle>
          <CardDescription>Released on their planned day, following each customer&apos;s publishing mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {approved.length === 0 ? <p className="text-muted-foreground">None.</p> : null}
          {approved.map((article) => (
            <p key={article.id}>
              <Link href={`/admin/network/${article.id}`} className="underline-offset-4 hover:underline">
                {article.title}
              </Link>{" "}
              <span className="text-muted-foreground">
                · {article.domain} · {day(article.plannedFor)} ·{" "}
                {article.placements === 0 ? "no network link" : `${article.placements} link${article.placements === 1 ? "" : "s"}`}
              </span>
            </p>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Participating websites ({queue.sites.length})</CardTitle>
            <CardDescription>
              Accepting network links, with the pages they want links to, in priority order. No limit applies to how many
              links a website hosts - the counts are for pacing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {queue.sites.map((site) => (
              <div key={site.websiteId} className="rounded-lg border p-3">
                <p className="font-medium">{site.domain}</p>
                <p className="text-xs text-muted-foreground">
                  {site.organizationName} · {site.industry ?? "No topic yet"} · {site.language ?? "No language yet"} ·{" "}
                  {connection[site.connected]}
                </p>
                <p className="text-xs">
                  Hosted: <span className="tabular-nums">{site.hosted.today}</span> today ·{" "}
                  <span className="tabular-nums">{site.hosted.thisMonth}</span> this month
                </p>
                {site.targets.length > 0 ? (
                  <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
                    {site.targets.map((target) => (
                      <li key={target.url} className="break-all">
                        {target.url} <span className="text-muted-foreground">({target.priority})</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No target pages listed.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credits by workspace</CardTitle>
            <CardDescription>
              Credits belong to a workspace, shared by all its websites. Available = balance minus credits reserved for
              committed links.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.credits.map((row) => (
                  <TableRow key={row.organizationId}>
                    <TableCell className="whitespace-normal break-words">{row.organizationName}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.balance}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.reserved}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.available}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
