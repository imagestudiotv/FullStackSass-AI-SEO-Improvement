import { notFound } from "next/navigation";

import Link from "next/link";

import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { formatDate } from "@/lib/i18n/format";
import { adminPartnerDetail } from "@/lib/partners/application/queries/admin-overview";
import { adminPartnerFinance } from "@/lib/partners/application/queries/admin-reports";
import { rateLabel } from "@/lib/partners/presentation/format";
import {
  adjustPartnerBalanceAction,
  createPartnerCouponAction,
  deactivatePartnerCouponAction,
  setPartnerPayoutHoldAction,
  setPartnerStatusAction,
} from "@/lib/partners/presentation/admin-actions";
import { idSchema } from "@/lib/partners/presentation/validation";
import { partnerDeps } from "@/lib/partners/server";

import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../../../_ui/page";
import { AdminStatus } from "../../../_ui/status";
import { Pagination } from "../../../pagination";
import { AmountReasonAction } from "../../_ui/amount-action";
import { CouponCreateForm } from "../../_ui/coupon-form";
import { BANK_LABEL, money, SETTLEMENT_LABEL, TRANSFER_LABEL } from "../../_ui/labels";
import { ReasonAction } from "../../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner" };

const when = (date: Date | null) =>
  date ? formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "-";

const SETUP_LABEL = {
  not_started: ["neutral", "Not started"],
  setup_required: ["pending", "Setup required"],
  verification_pending: ["info", "Verification pending"],
  restricted: ["warning", "Restricted"],
  ready: ["success", "Ready"],
} as const;

/** Admin -> Partners -> one partner: lifecycle, payout hold, payout setup and tier history. */
export default async function PartnerDetailPage({ params, searchParams }: PageProps<"/admin/partners/partners/[id]">) {
  const who = await requireAdmin();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const admin = { kind: "admin" as const, userId: who.userId, email: who.email };
  const deps = partnerDeps();
  const ledgerPage = pageFrom((await searchParams).page);
  const [detail, finance] = await Promise.all([adminPartnerDetail(deps, admin, id), adminPartnerFinance(deps, admin, { partnerId: id, page: ledgerPage })]);
  if (!detail) notFound();
  const currencies = [...new Set(["eur", ...(finance?.balances.map((balance) => balance.currency) ?? [])])];
  const { partner, account, tiers } = detail;
  const [setupTone, setupLabel] = SETUP_LABEL[detail.setup];

  return (
    <AdminPage>
      <AdminPageHeader
        title={partner.displayName}
        description={partner.contactEmail}
        back={{ href: "/admin/partners/partners", label: "Partners" }}
        meta={<AdminStatus tone={partner.status === "active" ? "success" : "danger"} label={partner.status === "active" ? "Active" : "Suspended"} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {partner.status === "active" ? (
              <ReasonAction
                action={setPartnerStatusAction.bind(null, partner.id, "suspended")}
                label="Suspend…"
                title="Suspend this partner?"
                description="Their history stays visible to them. New commissions are held and nothing is paid automatically until they are reactivated."
                confirmLabel="Suspend"
                success="Partner suspended"
                tone="danger"
              />
            ) : (
              <ReasonAction
                action={setPartnerStatusAction.bind(null, partner.id, "active")}
                label="Reactivate…"
                title="Reactivate this partner?"
                description="Their link works again and automatic payouts resume (unless payouts are held)."
                confirmLabel="Reactivate"
                success="Partner reactivated"
              />
            )}
            <ReasonAction
              action={setPartnerPayoutHoldAction.bind(null, partner.id, !partner.payoutHoldReason)}
              label={partner.payoutHoldReason ? "Release payout hold…" : "Hold payouts…"}
              title={partner.payoutHoldReason ? "Release the payout hold?" : "Hold this partner's payouts?"}
              description={
                partner.payoutHoldReason
                  ? "Automatic payouts resume at the next monthly run."
                  : "Commissions keep being recorded; no settlement is prepared for this partner while the hold is in place."
              }
              confirmLabel={partner.payoutHoldReason ? "Release hold" : "Hold payouts"}
              success={partner.payoutHoldReason ? "Hold released" : "Payouts held"}
              tone={partner.payoutHoldReason ? "default" : "danger"}
            />
          </div>
        }
      />

      <AdminSection title="Profile">
        <AdminFacts
          items={[
            { label: "Referral code", value: <span className="font-mono">{partner.referralCode}</span> },
            { label: "Tier", value: `${partner.tierKey} (${partner.qualifyingCustomers} qualifying customers)` },
            { label: "Payout country", value: partner.country ?? "-" },
            { label: "Approved", value: `${when(partner.approvedAt)} by ${partner.approvedByEmail}` },
            { label: "Suspended", value: partner.suspendedAt ? `${when(partner.suspendedAt)}: ${partner.suspendedReason ?? ""}` : "No" },
            { label: "Payout hold", value: partner.payoutHoldReason ?? "None" },
            { label: "Welcome email", value: partner.welcomeEmailSentAt ? when(partner.welcomeEmailSentAt) : "Not sent yet" },
          ]}
        />
      </AdminSection>

      <AdminSection title={`Payout setup (${detail.environment ?? "Stripe not configured"})`} description="As last read from Stripe. Identity and bank details stay with Stripe.">
        <div className="mb-4">
          <AdminStatus tone={setupTone} label={setupLabel} />
        </div>
        {account ? (
          <AdminFacts
            items={[
              { label: "Connected account", value: <span className="font-mono">{account.stripeAccountId ?? "Being created"}</span> },
              { label: "Details submitted", value: account.detailsSubmitted ? "Yes" : "No" },
              { label: "Transfers capability", value: account.transfersCapability ?? "-" },
              { label: "Payouts enabled", value: account.payoutsEnabled ? "Yes" : "No" },
              { label: "Payout schedule", value: account.payoutInterval ?? "-" },
              { label: "Currently due", value: account.requirementsCurrentlyDue.join(", ") || "Nothing" },
              { label: "Past due", value: account.requirementsPastDue.join(", ") || "Nothing" },
              { label: "Disabled reason", value: account.disabledReason ?? "-" },
              { label: "Last read from Stripe", value: when(account.lastSyncedAt) },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">The partner has not started payout setup.</p>
        )}
      </AdminSection>

      <AdminSection
        title={`Balances (${finance?.environment ?? "Stripe not configured"})`}
        description="From the immutable ledger, one currency at a time (never converted). Earned = pending + available + in a payout + transferred - corrections still to deduct."
        actions={
          finance ? (
            <AmountReasonAction
              action={adjustPartnerBalanceAction.bind(null, partner.id)}
              label="Adjust balance…"
              title="Adjust this partner's balance?"
              description="Adds a signed correction to the ledger (nothing existing is edited). A negative amount is deducted from upcoming payouts; a positive one can only cancel an earlier deduction."
              confirmLabel="Add adjustment"
              success="Adjustment recorded"
              amountHint="For example -24.75 to deduct, 24.75 to cancel an earlier deduction."
              currencies={currencies}
              allowNegative
            />
          ) : null
        }
      >
        {!finance || finance.balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commission recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {finance.balances.map((balance) => (
              <div key={balance.currency}>
                <h3 className="text-sm font-semibold uppercase">{balance.currency}</h3>
                <AdminFacts
                  className="mt-2"
                  items={[
                    { label: "Earned (net)", value: money(balance.earned, balance.currency) },
                    { label: "Pending (maturing, held, review)", value: money(balance.pending, balance.currency) },
                    { label: "Available", value: money(balance.available, balance.currency) },
                    { label: "In a payout", value: money(balance.inPayout, balance.currency) },
                    { label: "Transferred (net)", value: money(balance.transferred, balance.currency) },
                    { label: "Paid to bank (Stripe)", value: money(balance.bankPaid, balance.currency) },
                    { label: "Corrections to deduct", value: money(balance.offset, balance.currency) },
                    { label: "Owed (ledger liability)", value: money(balance.liability, balance.currency) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="underline underline-offset-4" href={`/admin/partners/commissions?partner=${partner.id}`}>
            Commissions
          </Link>
          <Link className="underline underline-offset-4" href={`/admin/partners/attribution?partner=${partner.id}`}>
            Referrals
          </Link>
          <Link className="underline underline-offset-4" href={`/admin/partners/export/ledger?partner=${partner.id}`}>
            Export ledger (CSV)
          </Link>
          <Link className="underline underline-offset-4" href={`/admin/partners/export/commissions?partner=${partner.id}`}>
            Export commissions (CSV)
          </Link>
        </p>
      </AdminSection>

      <AdminSection title="Recent payouts" bodyClassName="p-0">
        {!finance || finance.settlements.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No payout yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {finance.settlements.map((row) => {
              const [stateTone, stateLabel] = SETTLEMENT_LABEL[row.state];
              const [transferTone, transferLabel] = TRANSFER_LABEL[row.transfer];
              const [bankTone, bankLabel] = BANK_LABEL[row.bank];
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                  <Link className="font-medium tabular-nums underline-offset-4 hover:underline" href={`/admin/partners/payouts/${row.id}`}>
                    {money(row.transferAmount, row.currency)}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">{row.runKey}</span>
                  <AdminStatus tone={stateTone} label={stateLabel} />
                  <AdminStatus tone={transferTone} label={`Transfer: ${transferLabel}`} />
                  <AdminStatus tone={bankTone} label={`Bank: ${bankLabel}`} />
                </li>
              );
            })}
          </ul>
        )}
      </AdminSection>

      <AdminSection
        title="Coupons"
        description="Codes assigned to this partner. The partner sees only their active codes."
        actions={detail.environment && partner.status === "active" ? <CouponCreateForm action={createPartnerCouponAction.bind(null, partner.id)} currencies={currencies} /> : null}
      >
        {detail.coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coupon assigned.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.coupons.map((coupon) => (
              <li key={coupon.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium">{coupon.code}</span>
                <span className="text-muted-foreground">{coupon.campaign}</span>
                <span>{coupon.percentOffBasisPoints !== null ? rateLabel(coupon.percentOffBasisPoints) : money(coupon.amountOff, coupon.currency)}</span>
                <AdminStatus tone={coupon.status === "active" ? "success" : coupon.status === "failed" ? "danger" : "neutral"} label={coupon.status} />
                {coupon.status === "active" || coupon.status === "creating" ? (
                  <ReasonAction
                    action={deactivatePartnerCouponAction.bind(null, coupon.id)}
                    label="Deactivate…"
                    title={`Deactivate ${coupon.code}?`}
                    description="The promotion code stops working at Stripe for new checkouts."
                    confirmLabel="Deactivate"
                    success="Coupon deactivated"
                    tone="danger"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Ledger" description="Every financial entry for this partner, newest first. Entries are never edited or deleted." bodyClassName="p-0">
        {!finance || finance.ledger.rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <>
            <ul className="divide-y text-sm">
              {finance.ledger.rows.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{entry.kind.replace(/_/g, " ")}</span>{" "}
                      <span className="text-muted-foreground">
                        · {when(entry.createdAt)} · {entry.actor}
                      </span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">{entry.reason}</p>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">{entry.operationKey}</p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{money(entry.amount, entry.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t px-4 py-2">
              <Pagination page={finance.ledger.page} pageSize={finance.ledger.pageSize} total={finance.ledger.total} basePath={`/admin/partners/partners/${partner.id}`} />
            </div>
          </>
        )}
      </AdminSection>

      <AdminSection title="Tier history" description="Effective-dated. A tier applies to payments made while it was in force.">
        <ul className="space-y-2 text-sm">
          {tiers.map((tier) => (
            <li key={tier.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
              <span>
                <span className="capitalize font-medium">{tier.tierKey}</span> · {rateLabel(tier.rateBasisPoints)} · {tier.qualifyingCustomers} customers · policy v{tier.programVersion}
              </span>
              <span className="text-muted-foreground">
                {when(tier.effectiveFrom)} - {tier.effectiveTo ? when(tier.effectiveTo) : "now"}
              </span>
            </li>
          ))}
        </ul>
      </AdminSection>

      {detail.cases.length > 0 ? (
        <AdminSection title="Review cases">
          <ul className="space-y-2 text-sm">
            {detail.cases.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <AdminStatus tone={item.status === "open" ? "warning" : "neutral"} label={item.status} />
                <span className="font-medium">{item.kind.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{item.summary}</span>
              </li>
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}
