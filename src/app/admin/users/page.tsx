import { listUsers } from "@/lib/admin/actions";
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

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const rows = await listUsers(search);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Everyone with an account, newest first.
        </p>
      </div>

      <AdminSearch placeholder="Search email or name" defaultValue={search} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} user{rows.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Showing up to 100.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">
                  Organization
                </TableHead>
                <TableHead className="hidden w-28 sm:table-cell">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {row.email}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {row.organizationName ?? "—"}
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
    </div>
  );
}
