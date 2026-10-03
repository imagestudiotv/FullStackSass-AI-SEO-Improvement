import { CalendarCheck, ClipboardCheck, Coins, Gauge, Globe, Link2Off } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getReviewQueue, listMissingLinks, type QueueArticle } from "@/lib/admin/network";
import { FAILURES_BEFORE_REMOVED } from "@/lib/backlinks/placements";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";
import { AdminStatus, type StatusTone } from "../_ui/status";
import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { ExpandableText } from "../_ui/expandable-text";
import { MissingLinkActions } from "./missing-links";
import { RowLinksMenu, type RowLink } from "./row-menu";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner Network" };

/**
 * The loaders stop at these many rows and say nothing about it
 * (lib/admin/network.ts getReviewQueue, lib/backlinks/placements.ts
 * missingPlacements). Mirrored here only to say on screen that a full list
 * may be longer - the queries themselves are unchanged.
 */
const QUEUE_LIMIT = 200;
const MISSING_LIMIT = 100;

const n = (value: number) => formatNumber(value, "en");
const day = (value: Date | null) =>
  value ? formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "No date";

const CONNECTION: Record<QueueArticle["connected"], { label: string; tone: StatusTone }> = {
  cms: { label: "CMS connected", tone: "success" },
  plugin: { label: "WordPress plugin", tone: "success" },
  none: { label: "Not connected", tone: "warning" },
};

const websiteHref = (domain: string) => `/admin/websites?q=${encodeURIComponent(domain)}`;

/**
 * The managed Partner Network's review queue.
 *
 * Every article written for a participating website waits here until an
 * administrator has placed any relevant network links and approved it; no
 * publishing path delivers it before that (lib/articles/review.ts).
 *
 * One page, sections in the order they are worked: what waits for review,
 * links reported missing, what is approved and on its way, then the websites
 * taking part and each workspace's credits. The figures at the top jump to
 * their section (the overview links straight to #missing-links).
 */
export default async function AdminNetworkPage() {
  // getReviewQueue also grants each workspace's monthly credits on first read - keep calling it.
  const [queue, missing] = await Promise.all([getReviewQueue(), listMissingLinks()]);
  const pending = queue.articles.filter((a) => !a.approvedCurrent);
  const approved = queue.articles.filter((a) => a.approvedCurrent);
  const queueCut = queue.articles.length >= QUEUE_LIMIT;
  const missingCut = missing.length >= MISSING_LIMIT;
  const changed = pending.filter((a) => a.reviewStatus === "approved").length;
  const capped = (value: number, cut: boolean) => (cut ? `${n(value)}+` : n(value));

  return (
    <AdminPage>
      <AdminPageHeader
        title="Partner Network"
        description="Articles waiting for review, links reported missing, and the websites and workspaces taking part. Open an article to place links and approve it."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/network/operations" title="Publication freeze, managed review, authority and valuation">
              <Gauge className="size-4" aria-hidden="true" />
              Network operations
            </Link>
          </Button>
        }
      />

      <nav aria-label="Partner Network sections" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <AdminStat
          label="Waiting for review"
          value={capped(pending.length, queueCut)}
          href="#review"
          hint={changed > 0 ? `${n(changed)} changed since approval` : "Held until approved"}
        />
        <AdminStat
          label="Missing on recent checks"
          value={capped(missing.length, missingCut)}
          href="#missing-links"
          hint="Still live - nothing refunded"
        />
        <AdminStat label="Approved, not yet published" value={capped(approved.length, queueCut)} href="#approved" hint="Waiting for their planned day" />
        <AdminStat label="Participating websites" value={n(queue.sites.length)} href="#websites" hint="Accepting network links" />
        <AdminStat label="Workspaces" value={n(queue.credits.length)} href="#credits" hint="Credit balances of participating owners" />
      </nav>

      {/* Waiting for review */}
      <AdminSection
        id="review"
        title={`Waiting for review (${capped(pending.length, queueCut)})`}
        description={
          <>
            Held from every publishing path until approved. Oldest planned date first.
            {queueCut ? <CutNote>Only the first {n(QUEUE_LIMIT)} articles in the queue are loaded - more may be waiting.</CutNote> : null}
          </>
        }
        bodyClassName="p-0"
        className="scroll-mt-20"
      >
        {pending.length === 0 ? (
          <AdminEmpty filtering={false} icon={ClipboardCheck} noun="articles" title="Nothing is waiting." description="New drafts on participating websites appear here for review." />
        ) : (
          <SectionTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="hidden md:table-cell">Website</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead data-numeric className="hidden sm:table-cell">Links</TableHead>
                  <TableHead className="hidden xl:table-cell">Delivery</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-88 whitespace-normal">
                      <ArticleLink article={article} />
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground md:hidden">{article.domain}</span>
                    </TableCell>
                    <TableCell className="hidden max-w-64 whitespace-normal md:table-cell">
                      <span className="block [overflow-wrap:anywhere]">{article.domain}</span>
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground">
                        {article.organizationName}
                        {article.language ? ` · ${article.language}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{day(article.plannedFor)}</TableCell>
                    <TableCell>
                      {article.reviewStatus === "approved" ? (
                        <AdminStatus tone="warning" label="Changed since approval" title="Approved earlier, then changed - held until it is approved again" />
                      ) : (
                        <AdminStatus tone="pending" label="Pending" />
                      )}
                    </TableCell>
                    <TableCell data-numeric className="hidden sm:table-cell">{n(article.placements)}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <AdminStatus tone={CONNECTION[article.connected].tone} label={CONNECTION[article.connected].label} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowLinksMenu label={`Actions for ${article.title}`} links={articleLinks(article)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionTable>
        )}
      </AdminSection>

      {/*
        Live links that every recent check found missing. Nothing is refunded
        automatically (client, 2026-10-01): a host site in maintenance comes
        back with its links. When a customer reports one gone, an
        administrator checks it and removes it here, which refunds it.
      */}
      <AdminSection
        id="missing-links"
        title={`Missing on recent checks (${capped(missing.length, missingCut)})`}
        description={
          <>
            Live links not found at each of their last {FAILURES_BEFORE_REMOVED} checks. This is a report, not a removal: they
            are still listed as live for the customer and still checked daily, and a link that comes back simply stops
            appearing here. Nothing has been refunded. If one is really gone - usually after the customer reports it -
            remove it from its row menu: the customer gets the credits back and the host&apos;s reward is reversed.
            {missingCut ? <CutNote>Only the newest {n(MISSING_LIMIT)} are listed - there may be more.</CutNote> : null}
          </>
        }
        bodyClassName="p-0"
        className="scroll-mt-20"
      >
        {missing.length === 0 ? (
          <AdminEmpty filtering={false} icon={Link2Off} noun="links" title="Every live link was found at its last check." />
        ) : (
          <SectionTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Link to</TableHead>
                  <TableHead className="hidden md:table-cell">On page</TableHead>
                  <TableHead>Missing since</TableHead>
                  <TableHead className="hidden md:table-cell">Last checked</TableHead>
                  <TableHead data-numeric>Credits</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missing.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="max-w-72 whitespace-normal">
                      <ExpandableText text={link.targetUrl} mono threshold={40} />
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <span className="[overflow-wrap:anywhere]">{link.beneficiaryDomain}</span>
                        {link.managed ? <span>· managed</span> : null}
                      </span>
                      {/* Phones: the On page column is hidden; where the link was placed goes here. */}
                      <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere] md:hidden">
                        on {link.hostDomain ?? "a deleted host website"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-72 whitespace-normal md:table-cell">
                      {link.liveUrl ? (
                        <a
                          href={link.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={link.liveUrl}
                          className="relative block [overflow-wrap:anywhere] rounded-sm font-mono text-[13px] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {link.liveUrl}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      <span className="mt-0.5 block [overflow-wrap:anywhere] text-xs text-muted-foreground">{link.hostDomain ?? "host website deleted"}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{day(link.missingSince)}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{day(link.lastVerifiedAt)}</TableCell>
                    <TableCell data-numeric>{n(link.credits)}</TableCell>
                    <TableCell className="text-right">
                      <MissingLinkActions
                        placementId={link.id}
                        credits={link.credits}
                        targetUrl={link.targetUrl}
                        liveUrl={link.liveUrl}
                        hostDomain={link.hostDomain}
                        beneficiaryDomain={link.beneficiaryDomain}
                        missingSince={day(link.missingSince)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionTable>
        )}
      </AdminSection>

      {/* Approved, waiting for their day */}
      <AdminSection
        id="approved"
        title={`Approved, not yet published (${capped(approved.length, queueCut)})`}
        description="Released on their planned day, following each customer's publishing mode. Any change holds an article again."
        bodyClassName="p-0"
        className="scroll-mt-20"
      >
        {approved.length === 0 ? (
          <AdminEmpty filtering={false} icon={CalendarCheck} noun="articles" title="Nothing approved is waiting to publish." description="Approved articles stay here until they are published." />
        ) : (
          <SectionTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="hidden md:table-cell">Website</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Network links</TableHead>
                  <TableHead className="hidden xl:table-cell">Delivery</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approved.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-88 whitespace-normal">
                      <ArticleLink article={article} />
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground md:hidden">{article.domain}</span>
                    </TableCell>
                    <TableCell className="hidden max-w-64 whitespace-normal md:table-cell">
                      <span className="block [overflow-wrap:anywhere]">{article.domain}</span>
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground">{article.organizationName}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{day(article.plannedFor)}</TableCell>
                    <TableCell className="tabular-nums">
                      {article.placements === 0
                        ? <span className="text-muted-foreground">No network link</span>
                        : `${n(article.placements)} link${article.placements === 1 ? "" : "s"}`}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <AdminStatus tone={CONNECTION[article.connected].tone} label={CONNECTION[article.connected].label} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowLinksMenu label={`Actions for ${article.title}`} links={articleLinks(article)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionTable>
        )}
      </AdminSection>

      {/* Participating websites */}
      <AdminSection
        id="websites"
        title={`Participating websites (${n(queue.sites.length)})`}
        description="Accepting network links, with the pages they want links to, in priority order. No limit applies to how many links a website hosts - the counts are for pacing."
        bodyClassName="p-0"
        className="scroll-mt-20"
      >
        {queue.sites.length === 0 ? (
          <AdminEmpty filtering={false} icon={Globe} noun="websites" title="No website is taking part yet." description="Websites appear here once they accept Partner Network links." />
        ) : (
          <SectionTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Website</TableHead>
                  <TableHead className="hidden xl:table-cell">Topic · language</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead data-numeric className="hidden md:table-cell">Hosted today</TableHead>
                  <TableHead data-numeric className="hidden md:table-cell">This month</TableHead>
                  <TableHead className="hidden md:table-cell">Target pages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.sites.map((site) => (
                  <TableRow key={site.websiteId}>
                    <TableCell className="max-w-64 whitespace-normal">
                      <Link
                        href={websiteHref(site.domain)}
                        className="block [overflow-wrap:anywhere] rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {site.domain}
                      </Link>
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground">{site.organizationName}</span>
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground xl:hidden">
                        {site.industry ?? "No topic yet"} · {site.language ?? "No language yet"}
                      </span>
                      <span className="block text-xs tabular-nums text-muted-foreground md:hidden">
                        Hosted {n(site.hosted.today)} today · {n(site.hosted.thisMonth)} this month · {n(site.targets.length)} target
                        {site.targets.length === 1 ? " page" : " pages"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-56 whitespace-normal text-sm xl:table-cell">
                      <span className={site.industry ? undefined : "text-muted-foreground"}>{site.industry ?? "No topic yet"}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className={site.language ? undefined : "text-muted-foreground"}>{site.language ?? "No language yet"}</span>
                    </TableCell>
                    <TableCell>
                      <AdminStatus tone={CONNECTION[site.connected].tone} label={CONNECTION[site.connected].label} />
                    </TableCell>
                    <TableCell data-numeric className="hidden md:table-cell">{n(site.hosted.today)}</TableCell>
                    <TableCell data-numeric className="hidden md:table-cell">{n(site.hosted.thisMonth)}</TableCell>
                    <TableCell className="hidden min-w-48 max-w-80 whitespace-normal md:table-cell">
                      {site.targets.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No target pages listed.</span>
                      ) : (
                        <details className="group text-sm">
                          <summary className="cursor-pointer rounded-sm text-sm outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
                            {n(site.targets.length)} page{site.targets.length === 1 ? "" : "s"}
                          </summary>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                            {site.targets.map((target) => (
                              <li key={target.url} className="wrap-anywhere">
                                <span className="font-mono">{target.url}</span>{" "}
                                <span className="text-muted-foreground">({target.priority})</span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionTable>
        )}
      </AdminSection>

      {/* Credits per workspace */}
      <AdminSection
        id="credits"
        title={`Credits by workspace (${n(queue.credits.length)})`}
        description="Credits belong to a workspace, shared by all its websites. Available = balance minus credits reserved for committed links."
        bodyClassName="p-0"
        className="scroll-mt-20"
      >
        {queue.credits.length === 0 ? (
          <AdminEmpty filtering={false} icon={Coins} noun="workspaces" title="No workspaces yet." description="A workspace is listed once one of its websites takes part in the network." />
        ) : (
          <SectionTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead data-numeric>Balance</TableHead>
                  <TableHead data-numeric>Reserved</TableHead>
                  <TableHead data-numeric>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.credits.map((row) => (
                  <TableRow key={row.organizationId}>
                    <TableCell className="max-w-80 whitespace-normal">
                      <Link
                        href={`/admin/organizations?q=${encodeURIComponent(row.organizationName)}`}
                        className="rounded-sm font-medium underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell data-numeric>{n(row.balance)}</TableCell>
                    <TableCell data-numeric>{n(row.reserved)}</TableCell>
                    <TableCell data-numeric className="font-medium">
                      {n(row.available)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionTable>
        )}
      </AdminSection>
    </AdminPage>
  );
}

/** A table inside a section card: the list density, without a second frame. */
function SectionTable({ children }: { children: ReactNode }) {
  return <AdminTableCard className="rounded-t-none border-0 shadow-none">{children}</AdminTableCard>;
}

function CutNote({ children }: { children: ReactNode }) {
  return <span className="mt-1 block font-medium text-warning">{children}</span>;
}

function ArticleLink({ article }: { article: QueueArticle }) {
  return (
    <Link
      href={`/admin/network/${article.id}`}
      className="line-clamp-2 rounded-sm font-medium underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {article.title}
    </Link>
  );
}

function articleLinks(article: QueueArticle): RowLink[] {
  return [
    { href: `/admin/network/${article.id}`, label: "Open review", icon: "review" },
    { href: `/admin/articles/${article.id}`, label: "Open in Articles", icon: "article" },
    { href: websiteHref(article.domain), label: "Find website", icon: "website" },
  ];
}
