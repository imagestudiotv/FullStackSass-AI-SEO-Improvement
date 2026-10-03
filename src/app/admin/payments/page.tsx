import { Building2, Receipt, ScrollText, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPayments, type AdminPayment } from "@/lib/admin/actions";
import { DATE_RANGES, pageFrom } from "@/lib/admin/shared";
import { isNoCharge } from "@/lib/billing-shared";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { ExpandableText } from "../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus, type StatusTone } from "../_ui/status";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../_ui/toolbar";
import { pageHref, Pagination } from "../pagination";
import { formatMoney } from "./money";
import { PaymentActions } from "./refund-button";

export const metadata = { title: "Payments" };

// Reads live payment state, so it can never be prerendered.
export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/payments";

/**
 * The three questions actually asked of this page: what failed, what was
 * refunded, and what came through which processor. Refunds were the hardest
 * to answer: they sit among every successful payment, newest first, and a
 * customer disputing one names a date rather than an id.
 *
 * The date filter is labelled "Date" rather than "Paid", so it is not
 * confused with the "Paid" status.
 */
const FILTERS: ToolbarFilter[] = [
  {
    param: "status",
    label: "Status",
    allValue: "all",
    options: [
      { value: "all", label: "Any" },
      { value: "paid", label: "Paid" },
      { value: "refunded", label: "Refunded" },
      { value: "failed", label: "Failed" },
    ],
  },
  {
    param: "provider",
    label: "Processor",
    allValue: "all",
    options: [
      { value: "all", label: "Any" },
      { value: "stripe", label: "Stripe" },
      { value: "paypal", label: "PayPal" },
    ],
  },
  {
    param: "paid",
    label: "Date",
    allValue: "all",
    options: DATE_RANGES.map((range) => ({ ...range })),
  },
];

const n = (value: number) => formatNumber(value, "en");
const day = (date: Date) =>
  formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const clock = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date);

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ") : "Unknown";
}

function providerLabel(provider: string): string {
  if (provider === "stripe") return "Stripe";
  if (provider === "paypal") return "PayPal";
  return capitalise(provider);
}

/** What happened to the payment, as icon + word. */
function paymentStatus(row: AdminPayment): { tone: StatusTone; label: string; title?: string; icon?: LucideIcon } {
  /*
    A free trial's (or a 100% discount's) zero invoice: nothing was charged.
    The plan's first real charge arrives as its own row when the trial ends.
  */
  if (isNoCharge(row)) {
    return { tone: "neutral", label: "No charge", title: "A paid invoice for zero: a free trial or a fully discounted period." };
  }
  switch (row.status) {
    case "paid":
      return { tone: "success", label: "Paid" };
    case "refunded":
      return {
        tone: "info",
        label: "Refunded",
        icon: Undo2,
        title: "Money was sent back. A partial refund also shows as Refunded; refunds made here record their amount in the admin log.",
      };
    case "failed":
      // A payment record states what happened; "Needs attention" would read as a task for the operator.
      return { tone: "danger", label: "Failed" };
    default:
      return { tone: "neutral", label: capitalise(row.status) };
  }
}

/**
 * Why a paid payment cannot be refunded from here, or null when it can.
 * Mirrors the server's own refusal: PayPal refunds need a different capture
 * flow and are made in PayPal's dashboard, and a button that always fails is
 * worse than an explained, disabled one.
 */
function refundBlockedReason(provider: string): string | null {
  if (provider === "stripe") return null;
  if (provider === "paypal") return "PayPal payments are refunded in the PayPal dashboard, not here.";
  return "Only Stripe payments can be refunded here.";
}

/**
 * Every payment, with a refund control.
 *
 * Support's most common money question is "can you refund this", and until
 * now the answer meant opening Stripe, finding the charge, refunding it, and
 * then correcting the local record by hand. Two systems, no record of who did
 * it.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: PageProps<"/admin/payments">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  /** Set when arriving from a workspace, to see one customer's payments. */
  const organizationId =
    typeof params.org === "string" ? params.org : undefined;

  const status = typeof params.status === "string" ? params.status : "all";
  const provider =
    typeof params.provider === "string" ? params.provider : "all";
  const paid = typeof params.paid === "string" ? params.paid : "all";

  /** Search or filters. The workspace scope is not a filter: it has its own bar and way out. */
  const filtering = Boolean(
    search || status !== "all" || provider !== "all" || paid !== "all",
  );

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listPayments({
    search,
    organizationId,
    page,
    status,
    provider,
    paid,
  });

  const listParams = {
    q: search || undefined,
    org: organizationId,
    status: status !== "all" ? status : undefined,
    provider: provider !== "all" ? provider : undefined,
    paid: paid !== "all" ? paid : undefined,
  };
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  /** e.g. ?page=99 on a list of three pages: rows exist, just not on this page. */
  const pastEnd = rows.length === 0 && total > 0;

  /**
   * The workspace's name comes from the rows rather than a second query. With
   * no rows there is no confirmed name, so the bar says "one workspace's
   * payments" rather than guessing - but it is still shown, with its way out.
   */
  const scopedName = organizationId && rows.length > 0 ? (rows[0].organizationName ?? "Unknown workspace") : null;
  const allCustomersHref = pageHref(BASE_PATH, { ...listParams, org: undefined }, 1);
  // "Clear filters" keeps the workspace scope; leaving the scope is the bar's job.
  const clearHref = organizationId ? pageHref(BASE_PATH, { org: organizationId }, 1) : BASE_PATH;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Payments"
        description="Every payment taken, newest first. Refunds go back through Stripe and are recorded in the admin log."
        actions={
          <Button variant="outline" asChild className="h-9 bg-background">
            <Link href="/admin/activity?action=payment.refunded">
              <ScrollText className="size-4" aria-hidden="true" />
              Refund log
            </Link>
          </Button>
        }
      />

      {organizationId ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 wrap-anywhere">
            {scopedName ? (
              <>
                <span className="text-muted-foreground">Showing payments for </span>
                <span className="font-medium">{scopedName}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Showing one workspace&apos;s payments</span>
            )}
          </p>
          <Link
            href={allCustomersHref}
            className="shrink-0 rounded font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show all customers
          </Link>
        </div>
      ) : null}

      <AdminToolbar
        searchPlaceholder="Search customer or description"
        filters={FILTERS}
        keep={["org"]}
        resultLabel={`${n(total)} ${filtering ? "matching" : total === 1 ? "payment" : "payments"}`}
      />

      <AdminTableCard
        footer={
          rows.length > 0 ? (
            <Pagination page={page} pageSize={pageSize} total={total} params={listParams} basePath={BASE_PATH} />
          ) : undefined
        }
      >
        {rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead className="hidden xl:table-cell">For</TableHead>
                <TableHead className="hidden md:table-cell">Processor</TableHead>
                <TableHead data-numeric>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const amount = formatMoney(row.amountCents, row.currency);
                const name = row.organizationName ?? "Unknown workspace";
                const processor = providerLabel(row.provider);
                const date = day(row.paidAt);
                const time = clock(row.paidAt);
                const state = paymentStatus(row);
                const statusPill = <AdminStatus tone={state.tone} label={state.label} title={state.title} icon={state.icon} />;
                // Only a real, paid charge can be refunded; offered (or explained) nowhere else.
                const refundable = row.status === "paid" && !isNoCharge(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-32 whitespace-normal md:min-w-40">
                      {organizationId === row.organizationId ? (
                        <span className="font-medium wrap-anywhere">{name}</span>
                      ) : (
                        <Link
                          href={`${BASE_PATH}?org=${encodeURIComponent(row.organizationId)}`}
                          title="Show only this workspace's payments"
                          className="rounded font-medium underline-offset-4 outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {name}
                        </Link>
                      )}
                      {row.description ? (
                        <p title={row.description} className="mt-0.5 line-clamp-1 text-xs text-muted-foreground wrap-anywhere xl:hidden">
                          {row.description}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                        {processor} · <time dateTime={row.paidAt.toISOString()}>{date}</time>
                      </p>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {row.description ? (
                        <div className="max-w-72 text-muted-foreground">
                          <ExpandableText text={row.description} threshold={40} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{processor}</TableCell>
                    <TableCell data-numeric>
                      <span className="font-medium">{amount}</span>
                      <div className="mt-1 flex justify-end md:hidden">{statusPill}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{statusPill}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <time dateTime={row.paidAt.toISOString()} className="block tabular-nums">
                        {date}
                      </time>
                      <span className="block text-xs tabular-nums text-muted-foreground">{time} UTC</span>
                    </TableCell>
                    <TableCell className="w-12 text-right">
                      {refundable ? (
                        <PaymentActions
                          paymentId={row.id}
                          organizationName={name}
                          amountCents={row.amountCents}
                          currency={row.currency}
                          amountLabel={amount}
                          paidLabel={`${date}, ${time} UTC`}
                          description={row.description}
                          refundBlockedReason={refundBlockedReason(row.provider)}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : pastEnd ? (
          <AdminEmpty
            filtering={false}
            icon={Receipt}
            title="This page is past the end of the list"
            description={`${n(total)} ${total === 1 ? "payment" : "payments"} in this view, on ${n(lastPage)} ${lastPage === 1 ? "page" : "pages"}.`}
            noun="payments"
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(BASE_PATH, listParams, lastPage)}>Go to the last page</Link>
              </Button>
            }
          />
        ) : filtering ? (
          <AdminEmpty filtering icon={Receipt} title="No payments yet" noun="payments" clearHref={clearHref} />
        ) : organizationId ? (
          <AdminEmpty
            filtering={false}
            icon={Receipt}
            title="No payments for this workspace"
            description="No payment of any status has been recorded for this workspace."
            noun="payments"
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href={allCustomersHref}>Show all customers</Link>
              </Button>
            }
          />
        ) : (
          <AdminEmpty
            filtering={false}
            icon={Receipt}
            title="No payments yet"
            description="Payments appear here as soon as the first subscription or add-on is paid for."
            noun="payments"
          />
        )}
      </AdminTableCard>
    </AdminPage>
  );
}
