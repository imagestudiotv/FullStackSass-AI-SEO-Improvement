import { Users } from "lucide-react";
import { listUsers } from "@/lib/admin/actions";
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
import { WorkspaceActions } from "../organizations/workspace-actions";

import {

  BulkCheckbox,

  BulkDeleteBar,

  BulkSelectionProvider,

} from "../bulk-delete";

import { DeleteUserButton } from "./delete-user";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const membership =
    typeof params.membership === "string" ? params.membership : "all";
  const joined = typeof params.joined === "string" ? params.joined : "all";
  const filtering = Boolean(search || membership !== "all" || joined !== "all");

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listUsers(search, page, {
    membership,
    joined,
  });

  return (
    <BulkSelectionProvider>

    <PageShell width="default">
      <PageHeader
        title="Users"
        description="Everyone with an account, newest first."
      />

      <div className="space-y-3">
        <AdminSearch placeholder="Search email or name" defaultValue={search} />
        <FilterBar
          basePath="/admin/users"
          preserve={{ q: search || undefined }}
          filters={[
            {
              param: "membership",
              label: "Workspace",
              allValue: "all",
              options: [
                { value: "all", label: "Any" },
                { value: "some", label: "Has a workspace" },
                /*
                  Signing up creates a workspace, so an account without one
                  means something failed. Such people are invisible in a list
                  sorted by workspace, and are exactly who an operator hunts
                  for when a customer says they cannot get in.
                */
                { value: "none", label: "No workspace" },
              ],
            },
            {
              param: "joined",
              label: "Joined",
              allValue: "all",
              options: DATE_RANGES.map((range) => ({ ...range })),
            },
          ]}
        />
      </div>

      <BulkDeleteBar kind="users" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total} user{total === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (

            <EmptyRows

              filtering={filtering}

              icon={Users}

              noun="users"

              emptyTitle="No users yet"

              emptyDescription="Accounts appear here as soon as someone signs up."

            />

          ) : (
          <Table minWidth="62rem">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                {/*
                  Name and email in one column. They identify the same person
                  and were using two columns to say it, which is what left no
                  room for the website access an operator actually came for.
                */}
                <TableHead>Person</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Workspace
                </TableHead>
                <TableHead>Websites</TableHead>
                <TableHead className="w-36">Plan</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">
                  Joined
                </TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.id}:${row.organizationId ?? "none"}`}>
                  <TableCell>
                    {/*
                      One checkbox per PERSON, matching the delete button: a
                      row is a membership, so someone in three workspaces would
                      otherwise offer three checkboxes for one account and a
                      count that overstates what will be deleted.
                    */}
                    {rows.findIndex((other) => other.id === row.id) === index ? (
                      <BulkCheckbox id={row.id} label={row.email} />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.email}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell className="hidden max-w-48 truncate text-muted-foreground lg:table-cell">
                    {row.organizationName ?? "-"}
                  </TableCell>

                  <TableCell>
                    {/*
                      What this person can actually work on, and how they got
                      there. The two routes are shown differently on purpose:
                      workspace access covers every site the workspace owns
                      and cannot be withdrawn per site, while an invitation
                      covers exactly one. An operator asked "why can they see
                      that?" needs to tell them apart.
                    */}
                    {row.websites.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        None
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.websites.slice(0, 3).map((site) => (
                          <span
                            key={site.id}
                            title={
                              site.viaWorkspace
                                ? `${site.domain} - through the workspace`
                                : `${site.domain} - invited as ${site.role}`
                            }
                            className={
                              site.viaWorkspace
                                ? "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                                : "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground"
                            }
                          >
                            <span className="max-w-32 truncate">
                              {site.domain}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide opacity-70">
                              {site.role}
                            </span>
                          </span>
                        ))}
                        {/*
                          A count rather than a fourth chip. Someone with
                          twelve sites would otherwise make one row taller
                          than the rest of the table.
                        */}
                        {row.websites.length > 3 ? (
                          <span
                            title={row.websites
                              .slice(3)
                              .map((site) => site.domain)
                              .join(", ")}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            +{row.websites.length - 3}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {/*
                      The plan NAME with the subscription status under it.
                      "Growth" is the answer to what a customer pays for;
                      "active" only says a subscription exists.
                    */}
                    {row.planName ? (
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {row.planName}
                          {row.planInterval ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              / {row.planInterval}
                            </span>
                          ) : null}
                        </p>
                        {row.organizationStatus ? (
                          <StatusBadge status={row.organizationStatus} />
                        ) : null}
                      </div>
                    ) : row.organizationStatus ? (
                      <StatusBadge status={row.organizationStatus} />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No plan
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {/*
                      Scoped to the WORKSPACE, not the person. Suspension stops
                      generation and publishing for a workspace, and someone in
                      three of them cannot be suspended as an individual.
                    */}
                    <div className="flex items-center justify-end gap-1">
                      {row.organizationId ? (
                        <WorkspaceActions
                          organizationId={row.organizationId}
                          organizationName={row.organizationName ?? row.email}
                          status={row.organizationStatus}
                        />
                      ) : null}
                      {/*
                        One button per PERSON, not per membership row. Someone
                        in three workspaces appears three times, and three
                        delete buttons for one account would read as three
                        different things to delete.
                      */}
                      {rows.findIndex((other) => other.id === row.id) ===
                      index ? (
                        <DeleteUserButton userId={row.id} email={row.email} />
                      ) : null}
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
          membership: membership !== "all" ? membership : undefined,
          joined: joined !== "all" ? joined : undefined,
        }}
        basePath="/admin/users"
      />
    </PageShell>
    </BulkSelectionProvider>
  );
}
