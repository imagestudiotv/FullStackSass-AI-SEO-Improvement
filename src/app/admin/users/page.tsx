import { listUsers } from "@/lib/admin/actions";
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

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const rows = await listUsers(search);

  return (
    <PageShell width="default">
      <PageHeader
        title="Users"
        description="Everyone with an account, newest first."
      />

      <AdminSearch placeholder="Search email or name" defaultValue={search} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} user{rows.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Showing up to 100.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table minWidth="42rem">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">
                  Organization
                </TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">
                  Joined
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.id}:${row.organizationId ?? "none"}`}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {row.email}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {row.organizationName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.organizationStatus ? (
                      <StatusBadge status={row.organizationStatus} />
                    ) : null}
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
                    {row.organizationId ? (
                      <WorkspaceActions
                        organizationId={row.organizationId}
                        organizationName={row.organizationName ?? row.email}
                        status={row.organizationStatus}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
