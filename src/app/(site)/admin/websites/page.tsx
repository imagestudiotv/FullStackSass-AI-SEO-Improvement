import { AlertTriangle, CalendarClock, Globe } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listWebsites, type AdminWebsite } from "@/lib/admin/actions";
import { DATE_RANGES, pageFrom } from "@/lib/admin/shared";
import { firstArticleStatus } from "@/lib/articles/first-article-status";
import { listDailyLimits } from "@/lib/publishing/daily-cap";

import { ExpandableText } from "../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminStatus, type StatusTone } from "../_ui/status";
import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar } from "../_ui/toolbar";
import { BulkCheckbox, BulkDeleteBar, BulkRow, BulkSelectAll, BulkSelectionProvider } from "../bulk-delete";
import {
  DateCell,
  n,
  PastEndNotice,
  plural,
  RelatedLink,
  SubscriptionStatus,
} from "../organizations/list-parts";
import { pageHref, Pagination } from "../pagination";
import { WebsiteActions } from "./website-actions";

/**
 * Every website on the platform.
 *
 * WHY THIS PAGE EXISTS: a website could previously only be removed by
 * deleting the workspace that owned it - which also took the customer's
 * account, their other sites, their colleagues and their payment history. An
 * operator asked to remove one wrong domain had no proportionate way to do
 * it, and the Organizations page listed a website count without a way to look
 * at what it counted.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Websites" };

const BASE = "/admin/websites";

/** How long a website without an article says why under its name. */
const NO_ARTICLE_DAYS = 30;

/**
 * The values websites.status actually takes, in operator words. The filter
 * and the badge use the same label, so "Status: Failed" lists rows that say
 * Failed (the customer-facing wording - "Needs attention" - is for customers).
 */
const WEBSITE_STATUS: Record<string, { tone: StatusTone; label: string; title: string }> = {
  pending: { tone: "pending", label: "Pending", title: "Waiting to start the site analysis" },
  crawling: { tone: "info", label: "Crawling", title: "Reading the site" },
  researching: { tone: "info", label: "Researching", title: "Finding keyword opportunities" },
  ready: { tone: "success", label: "Ready", title: "Analysis finished" },
  failed: { tone: "danger", label: "Failed", title: "The site analysis did not finish" },
};

function WebsiteStatus({ status }: { status: string }) {
  const known = WEBSITE_STATUS[status];
  return <AdminStatus tone={known?.tone ?? "neutral"} label={known?.label ?? status} title={known?.title} />;
}

/**
 * One row per website. The query joins the workspace's subscriptions, so a
 * workspace billed for several websites repeats each of its websites once per
 * subscription; shown once here, with an active subscription preferred (the
 * same choice the Organizations list makes).
 */
function oncePerWebsite(rows: AdminWebsite[]): AdminWebsite[] {
  const byId = new Map<string, AdminWebsite>();
  for (const row of rows) {
    const seen = byId.get(row.id);
    if (!seen) byId.set(row.id, row);
    else if (seen.subscriptionStatus !== "active" && row.subscriptionStatus === "active") byId.set(row.id, row);
  }
  return [...byId.values()];
}

/**
 * Why a recent website has no article yet (lib/articles/first-article-status.ts),
 * so nobody has to guess. A reason that cannot be read is left out.
 */
async function noArticleReasons(rows: AdminWebsite[]): Promise<Map<string, string>> {
  const recent = Date.now() - NO_ARTICLE_DAYS * 24 * 60 * 60 * 1000;
  const waiting = rows.filter((row) => row.articleCount === 0 && row.createdAt.getTime() >= recent);
  const reasons = await Promise.all(waiting.map((row) => firstArticleStatus(row.id).catch(() => null)));
  return new Map(waiting.flatMap((row, i) => (reasons[i] ? [[row.id, reasons[i].message] as const] : [])));
}

export default async function AdminWebsitesPage({
  searchParams,
}: PageProps<"/admin/websites">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const added = typeof params.added === "string" ? params.added : "all";
  const filtering = Boolean(search || status !== "all" || added !== "all");

  const page = pageFrom(params.page);
  const result = await listWebsites(search, page, {
    status,
    added,
  });
  const { total, pageSize } = result;
  const rows = oncePerWebsite(result.rows);
  // Articles per day (lib/publishing/daily-cap.ts): every limit in force, shown above the table and in each row's menu.
  const limits = await listDailyLimits();
  const perDayOf = new Map(limits.map((limit) => [limit.websiteId, limit.perDay]));
  const whyOf = await noArticleReasons(rows);

  const listParams = {
    q: search || undefined,
    status: status !== "all" ? status : undefined,
    added: added !== "all" ? added : undefined,
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Websites"
        description="Every website across all workspaces, with its analysis status and the workspace that owns it. Newest first."
      />

      <AdminToolbar
        searchPlaceholder="Search domain or workspace"
        filters={[
          {
            param: "status",
            label: "Status",
            allValue: "all",
            options: [
              { value: "all", label: "Any" },
              ...Object.entries(WEBSITE_STATUS).map(([value, spec]) => ({ value, label: spec.label })),
            ],
          },
          {
            param: "added",
            label: "Added",
            allValue: "all",
            options: DATE_RANGES.map((range) => ({ ...range })),
          },
        ]}
        resultLabel={plural(total, "website")}
      />

      {/*
        The websites the scheduler writes for at a daily limit, whatever page
        they are on: the one place to see them all. Each is changed from its
        row menu, "Articles per day…" (the domain link finds the row).
      */}
      <section aria-labelledby="daily-limits" className="rounded-xl border bg-card p-4 text-sm">
        <h2 id="daily-limits" className="flex items-center gap-2 font-semibold">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          Daily article limits
        </h2>
        {limits.length === 0 ? (
          <p className="mt-1 text-muted-foreground">
            No website has one: each is written at its monthly allowance&apos;s pace. Set one from a website&apos;s menu,
            &quot;Articles per day…&quot;.
          </p>
        ) : (
          <>
            <ul className="mt-2 flex flex-wrap gap-2">
              {limits.map((limit) => (
                <li key={limit.websiteId}>
                  <RelatedLink
                    href={`${BASE}?q=${encodeURIComponent(limit.domain)}`}
                    label={`${limit.domain}: ${limit.perDay} a day - show its row`}
                    className="inline-flex rounded-md border px-2 py-1"
                  >
                    {limit.domain}: {limit.perDay} a day
                  </RelatedLink>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              The most articles written on their own per day, whatever the monthly allowance. Change or remove one from
              the website&apos;s menu, &quot;Articles per day…&quot;.
            </p>
          </>
        )}
      </section>

      <BulkSelectionProvider items={rows.map((row) => ({ id: row.id, label: row.domain }))}>
        <AdminTableCard
          toolbar={<BulkDeleteBar kind="websites" />}
          footer={
            rows.length > 0 ? (
              <Pagination page={page} pageSize={pageSize} total={total} params={listParams} basePath={BASE} />
            ) : null
          }
        >
          {rows.length === 0 ? (
            total > 0 ? (
              <PastEndNotice page={page} firstPageHref={pageHref(BASE, listParams, 1)} />
            ) : (
              <AdminEmpty
                filtering={filtering}
                icon={Globe}
                noun="websites"
                title="No websites yet"
                description="Websites appear here as soon as a customer adds one."
                clearHref={BASE}
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <BulkSelectAll label="Select every website on this page" />
                  </TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="hidden md:table-cell">Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead data-numeric className="hidden sm:table-cell">
                    Articles
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Workspace subscription</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const bareDomain = row.domain.toLowerCase().replace(/^www\./, "");
                  return (
                    <BulkRow key={row.id} id={row.id}>
                      <TableCell>
                        <BulkCheckbox id={row.id} label={row.domain} />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-80 min-w-0">
                          <ExpandableText text={row.domain} threshold={40} className="font-medium" />
                          {row.organizationName ? (
                            <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground md:hidden">{row.organizationName}</p>
                          ) : null}
                          {whyOf.get(row.id) ? <p className="mt-0.5 whitespace-normal text-xs text-muted-foreground">No article yet: {whyOf.get(row.id)}</p> : null}
                          {row.sameDomainElsewhere > 0 ? (
                            /* One WordPress site can publish for only one of them; the link lists them all. */
                            <p className="mt-0.5 flex items-start gap-1 whitespace-normal text-xs text-warning">
                              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                              <RelatedLink
                                href={`${BASE}?q=${encodeURIComponent(bareDomain)}`}
                                label={`Same domain in ${plural(row.sameDomainElsewhere, "other website")} - WordPress publishes for one only. Show them.`}
                              >
                                Same domain in {plural(row.sameDomainElsewhere, "other website")} - WordPress
                                publishes for one only
                              </RelatedLink>
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {row.organizationName ? (
                          <RelatedLink
                            href={`/admin/organizations?q=${encodeURIComponent(row.organizationName)}`}
                            label={`${row.organizationName} - open in Organizations`}
                            className="block max-w-56 [overflow-wrap:anywhere]"
                          >
                            {row.organizationName}
                          </RelatedLink>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <WebsiteStatus status={row.status} />
                      </TableCell>
                      <TableCell data-numeric className="hidden sm:table-cell">
                        {/* Articles has no website filter: the workspace filter plus the domain as the search. */}
                        {row.articleCount > 0 ? (
                          <RelatedLink
                            href={`/admin/articles?org=${encodeURIComponent(row.organizationId)}&q=${encodeURIComponent(row.domain)}`}
                            label={`${plural(row.articleCount, "article")} for ${row.domain}`}
                          >
                            {n(row.articleCount)}
                          </RelatedLink>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {/*
                          The WORKSPACE's subscription, not the site's. Shown
                          because it is what decides whether deleting this site
                          leaves someone paying for nothing - the dialog says so
                          too.
                        */}
                        <SubscriptionStatus status={row.subscriptionStatus} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        <DateCell value={row.createdAt} />
                      </TableCell>
                      <TableCell className="text-right">
                        <WebsiteActions
                          websiteId={row.id}
                          domain={row.domain}
                          url={row.url}
                          articleCount={row.articleCount}
                          organizationId={row.organizationId}
                          organizationName={row.organizationName}
                          perDay={perDayOf.get(row.id) ?? null}
                        />
                      </TableCell>
                    </BulkRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </AdminTableCard>
      </BulkSelectionProvider>
    </AdminPage>
  );
}
