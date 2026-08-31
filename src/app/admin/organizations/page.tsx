import { listOrganizations } from "@/lib/admin/actions";
import { Badge } from "@/components/ui/badge";
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
import { AdminSearch } from "../admin-search";

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
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Owner</TableHead>
                <TableHead className="w-28">Plan</TableHead>
                <TableHead className="w-20">Sites</TableHead>
                <TableHead className="w-24">Articles</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">
                    {row.ownerEmail ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.planName ? (
                      <Badge
                        variant={
                          row.status === "active" ? "default" : "secondary"
                        }
                      >
                        {row.planName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Free</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.websiteCount}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.articleCount}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(row.createdAt).toLocaleDateString()}
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
