import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import type { ReviewCaseKind } from "@/lib/partners/application/ports/repositories";
import { adminReviewCases, REVIEW_KINDS } from "@/lib/partners/application/queries/admin-reports";
import { confirmAttributionAction, disqualifyAttributionAction, resolveReviewCaseAction } from "@/lib/partners/presentation/admin-actions";
import { partnerDeps } from "@/lib/partners/server";

import { ExpandableText } from "../../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus } from "../../_ui/status";
import { AdminToolbar, type ToolbarFilter } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";
import { REVIEW_KIND_LABEL, when } from "../_ui/labels";
import { ReasonAction } from "../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner review cases" };

const STATUSES = ["open", "resolved", "dismissed"] as const;
const FILTERS: ToolbarFilter[] = [
  {
    param: "status",
    label: "Status",
    allValue: "all",
    options: [
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "resolved", label: "Resolved" },
      { value: "dismissed", label: "Dismissed" },
    ],
  },
  {
    param: "kind",
    label: "Kind",
    allValue: "all",
    options: [{ value: "all", label: "All" }, ...REVIEW_KINDS.map((kind) => ({ value: kind, label: REVIEW_KIND_LABEL[kind] }))],
  },
];

const ATTRIBUTION_KINDS = new Set<ReviewCaseKind>(["fraud_signal", "attribution_conflict", "coupon_conflict", "credit_cash_conflict"]);

/**
 * Admin -> Partner review cases: fraud signals, conflicts, disputes, payout
 * discrepancies and reconciliation findings. Opened by the system, never
 * guessed away; closed by a person with a reason. Where the case is about a
 * referral, the decision on the referral is taken here too.
 */
export default async function PartnerReviewsPage({ searchParams }: PageProps<"/admin/partners/reviews">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(params.status)) ? (params.status as (typeof STATUSES)[number]) : params.status === "all" ? undefined : "open";
  const kind = (REVIEW_KINDS as readonly string[]).includes(String(params.kind)) ? (params.kind as ReviewCaseKind) : undefined;
  const result = await adminReviewCases(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, { status, kind, page: pageFrom(params.page) });

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Partner review cases"
        description="What needs a person: shared network or device signals (never an automatic rejection), conflicting claims, disputes, unknown Stripe outcomes and reconciliation findings. Closing a case changes no money by itself."
        back={{ href: "/admin/partners", label: "Affiliate program" }}
      />
      <AdminToolbar filters={FILTERS} resultLabel={`${result.total} case${result.total === 1 ? "" : "s"}${status ? ` (${status})` : ""}`} />
      {result.rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty filtering={Boolean(kind) || status !== "open"} icon={ShieldAlert} noun="review cases" title="Nothing to review" description="Cases appear here when the system finds something a person must decide." clearHref="/admin/partners/reviews" />
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {result.rows.map((row) => (
              <li key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatus tone={row.status === "open" ? "warning" : "neutral"} label={row.status} />
                      <span className="font-medium">{REVIEW_KIND_LABEL[row.kind]}</span>
                      <span className="text-xs text-muted-foreground">{when(row.createdAt)}</span>
                      {row.environment ? <span className="text-xs text-muted-foreground">{row.environment}</span> : null}
                    </div>
                    <p className="text-sm">{row.summary}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {row.partner ? (
                        <Link className="underline underline-offset-4" href={`/admin/partners/partners/${row.partner.id}`}>
                          {row.partner.name}
                        </Link>
                      ) : null}
                      {row.customer ? <span>Customer: {row.customer.name} ({row.customer.domain ?? row.customer.reference})</span> : null}
                      {row.settlementId ? (
                        <Link className="underline underline-offset-4" href={`/admin/partners/payouts/${row.settlementId}`}>
                          Payout
                        </Link>
                      ) : null}
                      {row.commissionId ? <span className="font-mono">commission {row.commissionId.slice(0, 8)}</span> : null}
                      {row.attributionId ? <span className="font-mono">referral {row.attributionId.slice(0, 8)}</span> : null}
                    </p>
                    {Object.keys(row.evidence).length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <ExpandableText text={JSON.stringify(row.evidence)} />
                      </div>
                    ) : null}
                    {row.status !== "open" ? (
                      <p className="text-xs text-muted-foreground">
                        {row.status === "resolved" ? "Resolved" : "Dismissed"} by {row.resolvedByEmail} on {when(row.resolvedAt)}: {row.resolutionReason}
                      </p>
                    ) : null}
                  </div>
                  {row.status === "open" ? (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {row.attributionId && ATTRIBUTION_KINDS.has(row.kind) ? (
                        <>
                          <ReasonAction
                            action={confirmAttributionAction.bind(null, row.attributionId)}
                            label="Confirm referral…"
                            title="Confirm this referral?"
                            description="The referral counts: its commissions held for review are approved (unless the customer is also a credit referral). Then resolve the case."
                            confirmLabel="Confirm referral"
                            success="Referral confirmed"
                          />
                          <ReasonAction
                            action={disqualifyAttributionAction.bind(null, row.attributionId)}
                            label="Disqualify…"
                            title="Disqualify this referral?"
                            description="It earns nothing more and its unpaid commissions are rejected. Money already transferred stays recorded; recover it with a transfer reversal."
                            confirmLabel="Disqualify"
                            success="Referral disqualified"
                            tone="danger"
                          />
                        </>
                      ) : null}
                      <ReasonAction
                        action={resolveReviewCaseAction.bind(null, row.id, "resolved")}
                        label="Resolve…"
                        title="Resolve this case?"
                        description="Record what was decided. This changes no money by itself."
                        confirmLabel="Resolve"
                        success="Case resolved"
                      />
                      <ReasonAction
                        action={resolveReviewCaseAction.bind(null, row.id, "dismissed")}
                        label="Dismiss…"
                        title="Dismiss this case?"
                        description="Nothing needed doing. Say why."
                        confirmLabel="Dismiss"
                        success="Case dismissed"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/partners/reviews" params={{ status: params.status === "all" ? "all" : status, kind }} />
        </div>
      )}
    </AdminPage>
  );
}
