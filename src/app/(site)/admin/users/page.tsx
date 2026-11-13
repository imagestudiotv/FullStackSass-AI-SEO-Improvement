import { Users } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers, type AdminUser } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/guard";
import { DATE_RANGES, pageFrom } from "@/lib/admin/shared";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar } from "../_ui/toolbar";
import { BulkCheckbox, BulkDeleteBar, BulkRow, BulkSelectAll, BulkSelectionProvider } from "../bulk-delete";
import { DateCell, PastEndNotice, plural, RelatedLink, SubscriptionStatus } from "../organizations/list-parts";
import { pageHref, Pagination } from "../pagination";
import { UserActions } from "./user-actions";
import { WebsiteChips } from "./website-chips";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

const BASE = "/admin/users";

type Membership = {
  organizationId: string;
  organizationName: string;
  status: string | null;
  planName: string | null;
  planInterval: string | null;
};

type Person = Pick<AdminUser, "id" | "name" | "email" | "createdAt" | "websites"> & {
  workspaces: Membership[];
};

/**
 * One row per PERSON.
 *
 * The query returns a row per person x workspace x subscription. Shown as is,
 * someone in three workspaces appeared three times, each row listing ALL of
 * their websites (the websites belong to the person, not the row), and a
 * workspace with two subscriptions repeated the row outright. Folded here:
 * the person once, their workspaces listed inside the row, and for a
 * workspace with several subscriptions the active one preferred - the same
 * choice the Organizations list makes, so both pages offer the same
 * Suspend/Reactivate for it.
 */
function byPerson(rows: AdminUser[]): Person[] {
  const people = new Map<string, Person>();
  for (const row of rows) {
    let person = people.get(row.id);
    if (!person) {
      person = {
        id: row.id,
        name: row.name,
        email: row.email,
        createdAt: row.createdAt,
        websites: row.websites,
        workspaces: [],
      };
      people.set(row.id, person);
    }
    if (!row.organizationId) continue;
    const membership: Membership = {
      organizationId: row.organizationId,
      organizationName: row.organizationName ?? row.email,
      status: row.organizationStatus,
      planName: row.planName,
      planInterval: row.planInterval,
    };
    const index = person.workspaces.findIndex((entry) => entry.organizationId === row.organizationId);
    if (index === -1) person.workspaces.push(membership);
    else if (person.workspaces[index].status !== "active" && membership.status === "active") {
      person.workspaces[index] = membership;
    }
  }
  return [...people.values()];
}

function PlanLine({ workspace }: { workspace: Membership }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {/*
        The plan NAME with the subscription status beside it. "Growth" is the
        answer to what a customer pays for; "active" only says a subscription
        exists.
      */}
      {workspace.planName ? (
        <span>
          {workspace.planName}
          {workspace.planInterval ? <span className="text-muted-foreground"> / {workspace.planInterval}</span> : null}
        </span>
      ) : workspace.status ? null : (
        <span className="text-muted-foreground">No plan</span>
      )}
      {workspace.status ? <SubscriptionStatus status={workspace.status} /> : null}
    </div>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const membership = typeof params.membership === "string" ? params.membership : "all";
  const joined = typeof params.joined === "string" ? params.joined : "all";
  const filtering = Boolean(search || membership !== "all" || joined !== "all");

  const page = pageFrom(params.page);
  const [admin, result] = await Promise.all([
    // Who is looking: the server refuses to delete the operator's own account, so the row says so up front.
    requireAdmin(),
    listUsers(search, page, {
      membership,
      joined,
    }),
  ]);
  const { total, pageSize } = result;
  const people = byPerson(result.rows);
  const isSelf = (email: string) => email.toLowerCase() === admin.email.toLowerCase();

  const listParams = {
    q: search || undefined,
    membership: membership !== "all" ? membership : undefined,
    joined: joined !== "all" ? joined : undefined,
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Users"
        description="Everyone with an account, the workspaces they belong to and the websites they can work on. Newest first."
      />

      <AdminToolbar
        searchPlaceholder="Search email or name"
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
        resultLabel={plural(total, "user")}
      />

      <BulkSelectionProvider
        items={people.map((person) => ({
          id: person.id,
          label: person.email,
          selectable: !isSelf(person.email),
          reason: "You cannot delete your own account",
        }))}
      >
        <AdminTableCard
          toolbar={<BulkDeleteBar kind="users" />}
          footer={
            people.length > 0 ? (
              <Pagination page={page} pageSize={pageSize} total={total} params={listParams} basePath={BASE} />
            ) : null
          }
        >
          {people.length === 0 ? (
            total > 0 ? (
              <PastEndNotice page={page} firstPageHref={pageHref(BASE, listParams, 1)} />
            ) : (
              <AdminEmpty
                filtering={filtering}
                icon={Users}
                noun="users"
                title="No users yet"
                description="Accounts appear here as soon as someone signs up."
                clearHref={BASE}
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <BulkSelectAll label="Select every user on this page" />
                  </TableHead>
                  {/*
                    Name and email in one column. They identify the same person
                    and were using two columns to say it, which is what left no
                    room for the website access an operator actually came for.
                  */}
                  <TableHead>Person</TableHead>
                  <TableHead className="hidden md:table-cell">Workspaces and plan</TableHead>
                  <TableHead className="hidden md:table-cell">Websites</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <BulkRow key={person.id} id={person.id}>
                    <TableCell>
                      {/*
                        One checkbox per PERSON, matching the delete action: a
                        person in three workspaces is one account to delete.
                      */}
                      <BulkCheckbox id={person.id} label={person.email} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-72 min-w-0">
                        <p className="[overflow-wrap:anywhere] font-medium" title={person.name || person.email}>
                          {person.name || person.email}
                          {isSelf(person.email) ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                          ) : null}
                        </p>
                        {person.name ? (
                          <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground" title={person.email}>
                            {person.email}
                          </p>
                        ) : null}
                        {/* On a phone the workspace and website columns are hidden; their gist goes under the name. */}
                        <div className="mt-1.5 space-y-1 md:hidden">
                          {person.workspaces.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No workspace</p>
                          ) : (
                            person.workspaces.map((workspace) => (
                              <div key={workspace.organizationId} className="flex min-w-0 items-center gap-2">
                                <span className="[overflow-wrap:anywhere] text-xs">{workspace.organizationName}</span>
                                {workspace.status ? <SubscriptionStatus status={workspace.status} /> : null}
                              </div>
                            ))
                          )}
                          {person.websites.length > 0 ? <WebsiteChips sites={person.websites} /> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {person.workspaces.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No workspace</span>
                      ) : (
                        <ul className="max-w-72 space-y-2">
                          {person.workspaces.map((workspace) => (
                            <li key={workspace.organizationId} className="min-w-0 space-y-1">
                              <RelatedLink
                                href={`/admin/organizations?q=${encodeURIComponent(workspace.organizationName)}`}
                                label={`${workspace.organizationName} - open in Organizations`}
                                className="block [overflow-wrap:anywhere] text-sm"
                              >
                                {workspace.organizationName}
                              </RelatedLink>
                              <PlanLine workspace={workspace} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <WebsiteChips sites={person.websites} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      <DateCell value={person.createdAt} />
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions
                        userId={person.id}
                        email={person.email}
                        isSelf={isSelf(person.email)}
                        workspaces={person.workspaces.map((workspace) => ({
                          organizationId: workspace.organizationId,
                          organizationName: workspace.organizationName,
                          status: workspace.status,
                        }))}
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
