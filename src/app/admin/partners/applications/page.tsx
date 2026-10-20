import { Inbox } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { formatDate } from "@/lib/i18n/format";
import type { ApplicationStatus } from "@/lib/partners/domain/entities/application";
import { adminApplications } from "@/lib/partners/application/queries/admin-overview";
import { suggestReferralCode } from "@/lib/partners/application/use-cases/review-application";
import { approvePartnerApplicationAction, rejectPartnerApplicationAction } from "@/lib/partners/presentation/admin-actions";
import { partnerDeps } from "@/lib/partners/server";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus } from "../../_ui/status";
import { AdminTableCard } from "../../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";
import { ReasonAction } from "../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner applications" };

const STATUSES: ApplicationStatus[] = ["submitted", "approved", "rejected", "withdrawn"];
const FILTERS: ToolbarFilter[] = [
  {
    param: "status",
    label: "Status",
    allValue: "submitted",
    options: [
      { value: "submitted", label: "Waiting for review" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "all", label: "All" },
    ],
  },
];
const TONE = { submitted: "pending", approved: "success", rejected: "danger", withdrawn: "neutral" } as const;
const when = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Admin -> Partner applications. Approval creates the applicant's single
 * partner profile (idempotently) and queues one welcome email; rejection
 * needs a reason. Both are audited. The approval dialog is pre-filled with
 * the link name the applicant's name suggests (repget.com/?ref=<name>).
 */
export default async function PartnerApplicationsPage({ searchParams }: PageProps<"/admin/partners/applications">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "submitted";
  const status = rawStatus === "all" ? undefined : STATUSES.includes(rawStatus as ApplicationStatus) ? (rawStatus as ApplicationStatus) : "submitted";
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const { rows, total, page, pageSize } = await adminApplications(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, {
    status,
    search,
    page: pageFrom(params.page),
  });
  const deps = partnerDeps();
  const suggested = new Map(
    await Promise.all(
      rows.filter((row) => row.status === "submitted").map(async (row) => [row.id, (await suggestReferralCode(deps, row.applicantName)) ?? ""] as const),
    ),
  );

  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Partner applications" description="Applications to the affiliate program, newest first. Applicants sign in with their existing RepGet account; approval never creates a second login." />
      <AdminToolbar searchPlaceholder="Search name or email" searchLabel="Search applications" filters={FILTERS} resultLabel={`${total} application${total === 1 ? "" : "s"}`} />
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty filtering={Boolean(search) || rawStatus !== "submitted"} icon={Inbox} noun="applications" title="No applications here" description="New applications appear here when someone applies from the partner portal." clearHref="/admin/partners/applications" />
        </div>
      ) : (
        <AdminTableCard footer={<Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/partners/applications" params={{ status: rawStatus === "submitted" ? undefined : rawStatus, q: search }} />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead className="hidden lg:table-cell">Where and how</TableHead>
                <TableHead className="hidden md:table-cell">Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell data-align="top">
                    <p className="font-medium">{row.applicantName}</p>
                    <p className="text-xs text-muted-foreground">{row.applicantEmail}</p>
                    <p className="text-xs text-muted-foreground">Applied {when(row.submittedAt)}</p>
                  </TableCell>
                  <TableCell data-align="top" className="hidden max-w-md whitespace-normal lg:table-cell">
                    <p className="text-sm break-all">{row.answers.website}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.answers.audience}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.answers.promotion}</p>
                  </TableCell>
                  <TableCell data-align="top" className="hidden md:table-cell">{row.answers.country}</TableCell>
                  <TableCell data-align="top">
                    <AdminStatus tone={TONE[row.status]} label={row.status === "submitted" ? "Waiting" : row.status.charAt(0).toUpperCase() + row.status.slice(1)} />
                    {row.reviewedByEmail ? <p className="mt-1 text-xs text-muted-foreground">{row.reviewedByEmail}</p> : null}
                  </TableCell>
                  <TableCell data-align="top">
                    {row.status === "submitted" ? (
                      <div className="flex flex-wrap gap-2">
                        <ReasonAction
                          action={approvePartnerApplicationAction.bind(null, row.id)}
                          label="Approve…"
                          title={`Approve ${row.applicantName}?`}
                          description="Creates their partner profile on the base tier with the link below and sends one welcome email. They keep their existing login."
                          confirmLabel="Approve"
                          success="Approved"
                          reasonRequired={false}
                          field={{
                            label: "Link name",
                            prefix: "repget.com/?ref=",
                            initial: suggested.get(row.id) ?? "",
                            hint: "3-30 letters or digits, single hyphens allowed. Leave empty to pick one from their name automatically. You can change it later; old links keep working.",
                            maxLength: 30,
                          }}
                        />
                        <ReasonAction
                          action={rejectPartnerApplicationAction.bind(null, row.id)}
                          label="Reject…"
                          title={`Reject ${row.applicantName}?`}
                          description="They can apply again later with a new application."
                          confirmLabel="Reject"
                          success="Rejected"
                          tone="danger"
                        />
                      </div>
                    ) : row.reviewReason ? (
                      <p className="max-w-xs text-xs whitespace-normal text-muted-foreground">{row.reviewReason}</p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableCard>
      )}
    </AdminPage>
  );
}
