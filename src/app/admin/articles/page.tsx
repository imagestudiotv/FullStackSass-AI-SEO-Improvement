import Link from "next/link";

import { listAllArticles } from "@/lib/admin/actions";
import { Badge } from "@/components/ui/badge";
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

  const rows = await listAllArticles({ search, status });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Articles</h1>
        <p className="text-sm text-muted-foreground">
          Every article on the platform. Open one to read or edit it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AdminSearch
          placeholder="Search title or domain"
          defaultValue={search}
          extraParams={{ status }}
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((option) => (
            <Link
              key={option}
              href={`/admin/articles?status=${option}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
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
            {rows.length} article{rows.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>Showing up to 100, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
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
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {row.domain}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "published"
                          ? "default"
                          : row.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.status}
                    </Badge>
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
    </div>
  );
}
