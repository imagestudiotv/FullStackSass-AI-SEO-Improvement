import { Building2, FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllArticles } from "@/lib/admin/actions";
import { DATE_RANGES, pageFrom } from "@/lib/admin/shared";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { ExpandableText } from "../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar } from "../_ui/toolbar";
import { Pagination, pageHref } from "../pagination";
import { ARTICLE_STATUS_OPTIONS, ArticleStatus } from "./article-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Articles" };

const BASE = "/admin/articles";
const n = (value: number) => formatNumber(value, "en");
const day = (value: Date) =>
  formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayAndTime = (value: Date) =>
  `${formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

export default async function AdminArticlesPage({
  searchParams,
}: PageProps<"/admin/articles">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  /** Set when arriving from a workspace, to review one customer's articles. */
  const organizationId =
    typeof params.org === "string" ? params.org : undefined;
  const created = typeof params.created === "string" ? params.created : "all";

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listAllArticles({
    search,
    status,
    organizationId,
    created,
    page,
  });

  /**
   * The workspace being filtered to, taken from the rows rather than a second
   * query. An empty result means the name is unknown, so the scope line below
   * says "one customer" rather than naming a workspace we did not confirm.
   */
  const scoped = Boolean(organizationId);
  const filteredTo = organizationId ? rows[0]?.organizationName : undefined;

  /** The list's own parameters, carried by pagination and the links below. */
  const listParams = {
    q: search || undefined,
    org: organizationId || undefined,
    status: status !== "all" ? status : undefined,
    created: created !== "all" ? created : undefined,
  };
  const narrowed = Boolean(listParams.q || listParams.status || listParams.created);
  // The customer scope counts: "no articles match" is the honest answer for an empty scoped list.
  const filtering = narrowed || scoped;
  // Clearing search and filters keeps the customer scope first; with only the scope left, it lifts that.
  const clearHref = narrowed ? pageHref(BASE, { org: listParams.org }, 1) : BASE;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  // A page number past the end (an old link, a shrunken list): the rows exist, just not here.
  const pastTheEnd = rows.length === 0 && total > 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Articles"
        description="Every customer article on the platform, most recently updated first. Open one to read it or edit it."
      />

      {/*
        A filtered list must say so. Without this the page looks like the whole
        platform has three articles, which is exactly the wrong conclusion for
        an operator to reach. "Show all customers" lifts only the customer
        scope; search and filters stay.
      */}
      {scoped ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 wrap-anywhere">
            {filteredTo ? (
              <>
                <span className="text-muted-foreground">Showing articles for </span>
                <span className="font-medium">{filteredTo}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Showing one customer&apos;s articles</span>
            )}
          </p>
          <Link
            href={pageHref(BASE, { ...listParams, org: undefined }, 1)}
            className="rounded font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show all customers
          </Link>
        </div>
      ) : null}

      <AdminToolbar
        searchPlaceholder="Search title, website or customer"
        searchLabel="Search"
        keep={["org"]}
        resultLabel={`${n(total)} ${total === 1 ? "article" : "articles"}`}
        filters={[
          {
            param: "status",
            label: "Status",
            allValue: "all",
            options: ARTICLE_STATUS_OPTIONS,
          },
          {
            param: "created",
            label: "Created",
            allValue: "all",
            options: DATE_RANGES.map((range) => ({ ...range })),
          },
        ]}
      />

      <AdminTableCard
        footer={
          rows.length > 0 ? (
            <Pagination page={page} pageSize={pageSize} total={total} params={listParams} basePath={BASE} />
          ) : undefined
        }
      >
        {pastTheEnd ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">This page is past the end of the list</p>
            <p className="mt-1 max-w-sm text-sm tabular-nums text-muted-foreground">
              {n(total)} {total === 1 ? "article matches" : "articles match"}, on {n(lastPage)} {lastPage === 1 ? "page" : "pages"}.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href={pageHref(BASE, listParams, lastPage)}>Go to the last page</Link>
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <AdminEmpty
            filtering={filtering}
            icon={FileText}
            noun="articles"
            title="No articles yet"
            description="Articles appear here as customers plan and generate them."
            clearHref={clearHref}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="hidden lg:table-cell">Customer</TableHead>
                <TableHead className="hidden md:table-cell">Website</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead data-numeric className="hidden w-24 lg:table-cell">
                  Words
                </TableHead>
                <TableHead className="hidden w-36 sm:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const customerHref = pageHref(BASE, { ...listParams, org: row.organizationId }, 1);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-48 whitespace-normal">
                      <Link
                        href={`/admin/articles/${row.id}`}
                        className="line-clamp-2 rounded font-medium text-foreground underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.title || "Untitled article"}
                      </Link>
                      {/* On narrower screens the hidden columns' facts sit under the title. */}
                      <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-1.5 text-xs text-muted-foreground lg:hidden">
                        <span className="wrap-anywhere">{row.organizationName}</span>
                        <span className="md:hidden" aria-hidden="true">·</span>
                        <span className="wrap-anywhere md:hidden">{row.domain}</span>
                        <span className="sm:hidden" aria-hidden="true">·</span>
                        <span className="sm:hidden">Updated {day(row.updatedAt)}</span>
                      </p>
                    </TableCell>
                    {/*
                      Whose article this is. The link narrows the list to that
                      customer and keeps the current search and filters.
                    */}
                    <TableCell className="hidden lg:table-cell">
                      <Link
                        href={customerHref}
                        title={`Show only ${row.organizationName}'s articles`}
                        className="block max-w-56 [overflow-wrap:anywhere] rounded text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <ExpandableText text={row.domain} threshold={28} className="max-w-56" />
                    </TableCell>
                    <TableCell>
                      <ArticleStatus status={row.status} />
                    </TableCell>
                    <TableCell data-numeric className="hidden lg:table-cell">
                      {row.wordCount === null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        n(row.wordCount)
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                      <time dateTime={row.updatedAt.toISOString()} title={dayAndTime(row.updatedAt)}>
                        {day(row.updatedAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminTableCard>
    </AdminPage>
  );
}
