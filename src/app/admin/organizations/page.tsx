import { listOrganizations } from "@/lib/admin/actions";
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
import { AgencyToggle } from "./agency-toggle";
import { WorkspaceActions } from "./workspace-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage({
  searchParams,
}: PageProps<"/admin/organizations">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const rows = await listOrganizations(search);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Organizations"
        description="Every customer workspace, newest first."
      />

      <AdminSearch placeholder="Search by name" defaultValue={search} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} organization{rows.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            Showing up to 100. Use search to narrow the list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table minWidth="40rem">
            <TableHeader>
              <TableRow>
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
                    {row.ownerEmail ?? "—"}
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
        </CardContent>
      </Card>
    </PageShell>
  );
}
