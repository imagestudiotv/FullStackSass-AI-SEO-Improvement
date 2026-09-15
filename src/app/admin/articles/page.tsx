import Link from "next/link";

import { listAllArticles } from "@/lib/admin/actions";
import { pageFrom } from "@/lib/admin/shared";
import { Pagination } from "../pagination";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminSearch } from "../admin-search";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "draft", "generating", "published", "failed"];

export default async function AdminArticlesPage({
  searchParams,
}: PageProps<"/admin/articles">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  /** Set when arriving from a workspace, to review one customer's articles. */
  const organizationId =
    typeof params.org === "string" ? params.org : undefined;

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listAllArticles({
    search,
    status,
    organizationId,
    page,
  });

  /**
   * The workspace being filtered to, taken from the rows rather than a second
   * query. An empty result means the name is unknown, and the banner below is
   * hidden rather than naming a workspace we did not confirm exists.
   */
  const filteredTo = organizationId ? rows[0]?.organizationName : undefined;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Articles"
        description="Every article on the platform. Open one to read or edit it."
      />

      {/*
        A filtered list must say so. Without this the page looks like the whole
        platform has three articles, which is exactly the wrong conclusion for
        an operator to reach.
      */}
      {filteredTo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Showing articles for</span>
          <span className="font-medium">{filteredTo}</span>
          <Link
            href="/admin/articles"
            className="ml-auto text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Show all customers
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <AdminSearch
          placeholder="Search title, site or customer"
          defaultValue={search}
          extraParams={{ status, ...(organizationId ? { org: organizationId } : {}) }}
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((option) => (
            <Link
              key={option}
              href={`/admin/articles?status=${option}${search ? `&q=${encodeURIComponent(search)}` : ""}${organizationId ? `&org=${organizationId}` : ""}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                status === option
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {option}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total} article{total === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table minWidth="36rem">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Customer
                </TableHead>
                <TableHead className="hidden md:table-cell">Site</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="hidden w-20 sm:table-cell">
                  Words
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/admin/articles/${row.id}`}
                      className="hover:underline"
                    >
                      {row.title}
                    </Link>
                  </TableCell>
                  {/*
                    Whose article this is. It was queried already and never
                    shown, so a flat list of every customer's work gave no way
                    to tell one from another.
                  */}
                  <TableCell className="hidden max-w-48 truncate lg:table-cell">
                    <Link
                      href={`/admin/articles?org=${row.organizationId}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {row.organizationName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {row.domain}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={row.status}
                      label={row.status === "failed" ? "Failed" : undefined}
                    />
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {row.wordCount?.toLocaleString() ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        params={{
          q: search || undefined,
          status: status !== "all" ? status : undefined,
          org: organizationId,
        }}
        basePath="/admin/articles"
      />
    </PageShell>
  );
}
