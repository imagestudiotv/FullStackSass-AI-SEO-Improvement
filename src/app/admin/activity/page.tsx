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
import { listAdminActions, listAuditActors } from "@/lib/admin/audit";
import { DATE_RANGES, pageFrom, sinceFrom } from "@/lib/admin/shared";
import { FilterBar } from "../filter-bar";
import { Pagination } from "../pagination";

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
export default async function AdminActivityPage({
  searchParams,
}: PageProps<"/admin/activity">) {
  /**
   * Guarded here as well as in the layout. A layout does not re-run on
   * client-side navigation under partial rendering, and this page lists every
   * operator action across every workspace.
   */
  await requireAdmin();

  const params = await searchParams;
  const actor = typeof params.actor === "string" ? params.actor : "all";
  const action = typeof params.action === "string" ? params.action : "all";
  const when = typeof params.when === "string" ? params.when : "all";
  const page = pageFrom(params.page);

  /**
   * The actor list comes from the log itself, not from ADMIN_EMAILS: the
   * allowlist is who can act now, while this is who did act. Someone removed
   * from the allowlist still has entries, and filtering by them must stay
   * possible.
   */
  const filtering = actor !== "all" || action !== "all" || when !== "all";

  const [{ rows, total, pageSize }, actors] = await Promise.all([
    listAdminActions({ page, actor, action, since: sinceFrom(when) }),
    listAuditActors(),
  ]);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Admin activity"
        description="Every change an administrator has made, newest first. Entries are never edited or removed."
      />

      <FilterBar
        basePath="/admin/activity"
        filters={[
          {
            param: "actor",
            label: "Who",
            allValue: "all",
            options: [
              { value: "all", label: "Anyone" },
              ...actors.map((email) => ({ value: email, label: email })),
            ],
          },
          {
            param: "action",
            label: "Action",
            allValue: "all",
            options: [
              { value: "all", label: "Any action" },
              { value: "payment.refunded", label: "Refunds" },
              { value: "credits.adjusted", label: "Credit adjustments" },
              { value: "organization.limits_changed", label: "Limit changes" },
              { value: "organization.deactivated", label: "Deactivations" },
              { value: "organization.reactivated", label: "Reactivations" },
              { value: "organization.deleted", label: "Workspace deletions" },
              { value: "user.deleted", label: "User deletions" },
              { value: "article.updated", label: "Article edits" },
              { value: "article.deleted", label: "Article deletions" },
            ],
          },
          {
            param: "when",
            label: "When",
            allValue: "all",
            options: DATE_RANGES.map((range) => ({ ...range })),
          },
        ]}
      />

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            /*
              Two different empty states. "Nothing recorded yet" under an
              active filter is a lie that sends an operator looking for a bug
              in the log rather than widening their filter.
            */
            <EmptyState
              icon={ScrollText}
              title={
                filtering ? "Nothing matches" : "Nothing recorded yet"
              }
              description={
                filtering
                  ? "No entries match these filters. Clear them to see everything."
                  : "Refunds, credit adjustments and account changes appear here as they happen."
              }
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

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        params={{
          actor: actor !== "all" ? actor : undefined,
          action: action !== "all" ? action : undefined,
          when: when !== "all" ? when : undefined,
        }}
        basePath="/admin/activity"
      />
    </PageShell>
  );
}
