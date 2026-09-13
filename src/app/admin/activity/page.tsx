import { ScrollText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdminActions } from "@/lib/admin/audit";

export const metadata = { title: "Admin activity" };

export const dynamic = "force-dynamic";

/**
 * What administrators have done.
 *
 * The counterpart to the actions themselves: refunds, credit adjustments and
 * deactivations all write here before they touch anything. This page is the
 * reason a dispute about whether a refund was issued has an answer.
 *
 * Read-only by design. There is no control to remove an entry, because a log
 * that can be tidied proves nothing.
 */
export default async function AdminActivityPage() {
  /**
   * Guarded here as well as in the layout. A layout does not re-run on
   * client-side navigation under partial rendering, and this page lists every
   * operator action across every workspace.
   */
  await requireAdmin();

  const rows = await listAdminActions();

  return (
    <PageShell width="wide">
      <PageHeader
        title="Admin activity"
        description="Every change an administrator has made, newest first. Entries are never edited or removed."
      />

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nothing recorded yet"
              description="Refunds, credit adjustments and account changes appear here as they happen."
            />
          ) : (
            <Table minWidth="46rem">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">When</TableHead>
                  <TableHead className="hidden w-52 sm:table-cell">
                    Who
                  </TableHead>
                  <TableHead>What</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {row.createdAt.toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell className="hidden max-w-52 truncate text-muted-foreground sm:table-cell">
                      {row.actorEmail}
                    </TableCell>
                    {/*
                      The summary is written for a person at the time of the
                      action, so it reads without needing the action code
                      beside it. The code stays available in the row for
                      anyone querying the table directly.
                    */}
                    <TableCell>{row.summary}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
