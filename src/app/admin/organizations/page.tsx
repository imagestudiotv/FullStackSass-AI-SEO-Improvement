import { Building2 } from "lucide-react";
import { listOrganizations } from "@/lib/admin/actions";
import { pageFrom } from "@/lib/admin/shared";
import { EmptyRows } from "../empty-rows";
import { FilterBar } from "../filter-bar";
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
import Link from "next/link";

import { AdminSearch } from "../admin-search";
import {
  BulkCheckbox,
  BulkDeleteBar,
  BulkSelectionProvider,
} from "../bulk-delete";
import { AgencyToggle } from "./agency-toggle";
import { WorkspaceActions } from "./workspace-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage({
  searchParams,
}: PageProps<"/admin/organizations">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const kind = typeof params.kind === "string" ? params.kind : "all";
  const filtering = Boolean(search || status !== "all" || kind !== "all");

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listOrganizations(search, page, {
    status,
    kind,
  });

  return (
    <BulkSelectionProvider>
    <PageShell width="wide">
      <PageHeader
        title="Organizations"
        description="Every customer workspace, newest first."
      />

      <div className="space-y-3">
        <AdminSearch placeholder="Search by name" defaultValue={search} />
        <FilterBar
          basePath="/admin/organizations"
          preserve={{ q: search || undefined }}
          filters={[
            {
              param: "status",
              label: "Subscription",
              allValue: "all",
              options: [
                { value: "all", label: "Any" },
                { value: "active", label: "Active" },
                { value: "past_due", label: "Past due" },
                { value: "canceled", label: "Canceled" },
                { value: "inactive", label: "Inactive" },
                /*
                  Never subscribed is not a status value — there is no row to
                  match — so the query handles it as IS NULL. Without this an
                  operator cannot find accounts that never paid.
                */
                { value: "none", label: "Never subscribed" },
              ],
            },
            {
              param: "kind",
              label: "Type",
              allValue: "all",
              options: [
                { value: "all", label: "All workspaces" },
                { value: "customer", label: "Customers" },
                /*
                  Our own workspaces seed the backlink network and skew every
                  count on this page, so separating them is the first thing
                  anyone reading the list wants.
                */
                { value: "agency", label: "Agency (ours)" },
              ],
            },
          ]}
        />
      </div>

      <BulkDeleteBar kind="organizations" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total} organization{total === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            Newest first. Use search to find one by name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (

            <EmptyRows

              filtering={filtering}

              icon={Building2}

              noun="workspaces"

              emptyTitle="No workspaces yet"

              emptyDescription="Workspaces appear here as soon as someone signs up."

            />

          ) : (
          <Table minWidth="46rem">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Owner</TableHead>
                <TableHead className="w-28">Plan</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-20">Sites</TableHead>
                <TableHead className="w-24">Articles</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">
                  Joined
                </TableHead>
                <TableHead className="w-32">Agency</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <BulkCheckbox id={row.id} label={row.name} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate font-medium">
                    <Link
                      href={`/admin/payments?org=${row.id}`}
                      className="hover:underline"
                      title={`Payments for ${row.name}`}
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">
                    {row.ownerEmail ?? "-"}
                  </TableCell>
                  <TableCell>
                    {row.planName ? (
                      <span className="text-sm">{row.planName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Free</span>
                    )}
                  </TableCell>
                  {/*
                    Suspension has to be readable from the list. An operator
                    scanning for "why is this customer not publishing" should
                    see it here rather than opening a menu on each row.
                  */}
                  <TableCell>
                    {row.status ? <StatusBadge status={row.status} /> : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.websiteCount}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {/*
                      The count is the way in. An operator reading "14
                      articles" and wanting to see them should not have to go
                      to Articles and search for the workspace by name.
                    */}
                    {row.articleCount > 0 ? (
                      <Link
                        href={`/admin/articles?org=${row.id}`}
                        className="hover:underline"
                      >
                        {row.articleCount}
                      </Link>
                    ) : (
                      row.articleCount
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AgencyToggle
                      organizationId={row.id}
                      organizationName={row.name}
                      isAgency={row.isAgency}
                    />
                  </TableCell>
                  <TableCell>
                    <WorkspaceActions
                      organizationId={row.id}
                      organizationName={row.name}
                      status={row.status}
                    />
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
          kind: kind !== "all" ? kind : undefined,
        }}
        basePath="/admin/organizations"
      />
    </PageShell>
    </BulkSelectionProvider>
  );
}
