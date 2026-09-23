import { Globe } from "lucide-react";

import { listWebsites } from "@/lib/admin/actions";
import { DATE_RANGES, pageFrom } from "@/lib/admin/shared";
import { EmptyRows } from "../empty-rows";
import { FilterBar } from "../filter-bar";
import { Pagination } from "../pagination";
import { PageHeader, PageShell } from "@/components/ui/page-header";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminSearch } from "../admin-search";
import {
  BulkCheckbox,
  BulkDeleteBar,
  BulkSelectionProvider,
} from "../bulk-delete";
import { DeleteWebsiteButton } from "./delete-website";

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

export default async function AdminWebsitesPage({
  searchParams,
}: PageProps<"/admin/websites">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const added = typeof params.added === "string" ? params.added : "all";
  const filtering = Boolean(search || status !== "all" || added !== "all");

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listWebsites(search, page, {
    status,
    added,
  });

  return (
    <BulkSelectionProvider>
      <PageShell width="default">
        <PageHeader
          title="Websites"
          description="Every website across all workspaces, newest first."
        />

        <div className="space-y-3">
          <AdminSearch
            placeholder="Search domain or workspace"
            defaultValue={search}
          />
          <FilterBar
            basePath="/admin/websites"
            preserve={{ q: search || undefined }}
            filters={[
              {
                param: "status",
                label: "Status",
                allValue: "all",
                options: [
                  { value: "all", label: "Any" },
                  /*
                    The values websites.status actually takes. A filter
                    offering a state the column never holds returns nothing
                    and reads as broken rather than empty.
                  */
                  { value: "pending", label: "Pending" },
                  { value: "crawling", label: "Crawling" },
                  { value: "researching", label: "Researching" },
                  { value: "ready", label: "Ready" },
                  { value: "failed", label: "Failed" },
                ],
              },
              {
                param: "added",
                label: "Added",
                allValue: "all",
                options: DATE_RANGES.map((range) => ({ ...range })),
              },
            ]}
          />
        </div>

        <BulkDeleteBar kind="websites" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {total} website{total === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>Newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <EmptyRows
                filtering={filtering}
                icon={Globe}
                noun="websites"
                emptyTitle="No websites yet"
                emptyDescription="Websites appear here as soon as a customer adds one."
              />
            ) : (
              <Table minWidth="52rem">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Domain</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Workspace
                    </TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="hidden w-24 sm:table-cell">
                      Articles
                    </TableHead>
                    <TableHead className="hidden w-28 lg:table-cell">
                      Plan
                    </TableHead>
                    <TableHead className="hidden w-28 sm:table-cell">
                      Added
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <BulkCheckbox id={row.id} label={row.domain} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.domain}
                      </TableCell>
                      <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell">
                        {row.organizationName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                        {row.articleCount}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {/*
                          The WORKSPACE's plan, not the site's. Shown because
                          it is what decides whether deleting this site leaves
                          someone paying for nothing - the dialog says so too.
                        */}
                        {row.subscriptionStatus ? (
                          <StatusBadge status={row.subscriptionStatus} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <DeleteWebsiteButton
                            websiteId={row.id}
                            domain={row.domain}
                            articleCount={row.articleCount}
                            organizationName={row.organizationName}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          params={{
            q: search || undefined,
            status: status !== "all" ? status : undefined,
            added: added !== "all" ? added : undefined,
          }}
          basePath="/admin/websites"
        />
      </PageShell>
    </BulkSelectionProvider>
  );
}
