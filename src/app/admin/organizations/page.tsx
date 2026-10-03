import { Building2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listOrganizations } from "@/lib/admin/actions";
import { pageFrom } from "@/lib/admin/shared";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar } from "../_ui/toolbar";
import { BulkCheckbox, BulkDeleteBar, BulkRow, BulkSelectAll, BulkSelectionProvider } from "../bulk-delete";
import { pageHref, Pagination } from "../pagination";
import {
  AgencyBadge,
  DateCell,
  n,
  PastEndNotice,
  plural,
  RelatedLink,
  SUBSCRIPTION_FILTER,
  SubscriptionStatus,
} from "./list-parts";
import { WorkspaceActions } from "./workspace-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizations" };

const BASE = "/admin/organizations";

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

  const listParams = {
    q: search || undefined,
    status: status !== "all" ? status : undefined,
    kind: kind !== "all" ? kind : undefined,
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Organizations"
        description="Every workspace - customers and our own agency workspaces - with its plan, subscription and what it holds. Newest first."
      />

      <AdminToolbar
        searchPlaceholder="Search by workspace name"
        searchLabel="Search"
        filters={[
          SUBSCRIPTION_FILTER,
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
        resultLabel={plural(total, "organization")}
      />

      <BulkSelectionProvider items={rows.map((row) => ({ id: row.id, label: row.name }))}>
        <AdminTableCard
          toolbar={<BulkDeleteBar kind="organizations" />}
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
                icon={Building2}
                noun="workspaces"
                title="No workspaces yet"
                description="Workspaces appear here as soon as someone signs up."
                clearHref={BASE}
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <BulkSelectAll label="Select every workspace on this page" />
                  </TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead>
                    {/* Headers do not wrap; the long word alone made the table wider than a phone. */}
                    <span className="sm:hidden">Status</span>
                    <span className="hidden sm:inline">Subscription</span>
                  </TableHead>
                  <TableHead data-numeric className="hidden md:table-cell">
                    Websites
                  </TableHead>
                  <TableHead data-numeric className="hidden xl:table-cell">
                    Members
                  </TableHead>
                  <TableHead data-numeric className="hidden md:table-cell">
                    Articles
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Joined</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <BulkRow key={row.id} id={row.id}>
                    <TableCell>
                      <BulkCheckbox id={row.id} label={row.name} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-72 min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="[overflow-wrap:anywhere] font-medium" title={row.name}>
                            {row.name}
                          </p>
                          {row.isAgency ? (
                            <span className="sm:hidden">
                              <AgencyBadge />
                            </span>
                          ) : null}
                        </div>
                        {/* The owner is how support finds a workspace; their account is one click away. */}
                        <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">
                          {row.ownerEmail ? (
                            <RelatedLink
                              href={`/admin/users?q=${encodeURIComponent(row.ownerEmail)}`}
                              label={`Owner ${row.ownerEmail} - open in Users`}
                            >
                              {row.ownerEmail}
                            </RelatedLink>
                          ) : (
                            "No owner"
                          )}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-col items-start gap-1">
                        {row.isAgency ? <AgencyBadge /> : null}
                        {row.planName ? (
                          <span className="text-sm">{row.planName}</span>
                        ) : row.isAgency ? null : (
                          <span className="text-sm text-muted-foreground">No plan</span>
                        )}
                      </div>
                    </TableCell>
                    {/*
                      Suspension has to be readable from the list. An operator
                      scanning for "why is this customer not publishing" should
                      see it here rather than opening a menu on each row.
                    */}
                    <TableCell>
                      <SubscriptionStatus status={row.status} />
                    </TableCell>
                    <TableCell data-numeric className="hidden md:table-cell">
                      {/* Websites has no workspace filter; its search matches workspace names. */}
                      {row.websiteCount > 0 ? (
                        <RelatedLink
                          href={`/admin/websites?q=${encodeURIComponent(row.name)}`}
                          label={`${plural(row.websiteCount, "website")} - search Websites for ${row.name}`}
                        >
                          {n(row.websiteCount)}
                        </RelatedLink>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell data-numeric className="hidden xl:table-cell">
                      {n(row.memberCount)}
                    </TableCell>
                    <TableCell data-numeric className="hidden md:table-cell">
                      {/*
                        The count is the way in. An operator reading "14
                        articles" and wanting to see them should not have to go
                        to Articles and search for the workspace by name.
                      */}
                      {row.articleCount > 0 ? (
                        <RelatedLink
                          href={`/admin/articles?org=${encodeURIComponent(row.id)}`}
                          label={`${plural(row.articleCount, "article")} in ${row.name}`}
                        >
                          {n(row.articleCount)}
                        </RelatedLink>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      <DateCell value={row.createdAt} />
                    </TableCell>
                    <TableCell className="text-right">
                      <WorkspaceActions
                        organizationId={row.id}
                        organizationName={row.name}
                        status={row.status}
                        isAgency={row.isAgency}
                      />
                    </TableCell>
                  </BulkRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AdminTableCard>
      </BulkSelectionProvider>
    </AdminPage>
  );
}
