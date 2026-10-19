import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin/guard";
import { formatDate } from "@/lib/i18n/format";
import { adminPartnerDetail } from "@/lib/partners/application/queries/admin-overview";
import { rateLabel } from "@/lib/partners/presentation/format";
import { setPartnerPayoutHoldAction, setPartnerStatusAction } from "@/lib/partners/presentation/admin-actions";
import { idSchema } from "@/lib/partners/presentation/validation";
import { partnerDeps } from "@/lib/partners/server";

import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../../../_ui/page";
import { AdminStatus } from "../../../_ui/status";
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
export default async function PartnerDetailPage({ params }: PageProps<"/admin/partners/partners/[id]">) {
  const who = await requireAdmin();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const detail = await adminPartnerDetail(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, id);
  if (!detail) notFound();
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
