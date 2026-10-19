import Link from "next/link";

import { requireAdmin } from "@/lib/admin/guard";
import { adminProgramOverview } from "@/lib/partners/application/queries/admin-overview";
import { setPartnerControlAction } from "@/lib/partners/presentation/admin-actions";
import { partnerDeps } from "@/lib/partners/server";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";
import { AdminStatus } from "../_ui/status";
import { ReasonAction } from "./_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Affiliate program" };

const SWITCHES = [
  {
    key: "partner_program",
    title: "Program visibility",
    on: "Applications and new partner-link tracking are open. The public page offers the application form.",
    off: "Applications are closed and partner links record nothing new. Approved partners keep their portal and history.",
  },
  {
    key: "partner_commissions",
    title: "Commission processing",
    on: "Stripe payments are turned into commissions as they arrive.",
    off: "Affiliate work from Stripe events is still RECORDED and waits; it is processed once this is switched on.",
  },
  {
    key: "partner_payouts",
    title: "Payouts (money movement)",
    on: "Monthly settlements, Stripe transfers and new bank payouts may start. Live money additionally needs PARTNER_LIVE_PAYOUTS=enabled.",
    off: "No new settlement, transfer or bank payout starts. Operations already sent to Stripe keep being tracked and reconciled.",
  },
] as const;

/**
 * Admin -> Affiliate program: the three switches (each with a reason,
 * audited), what is configured on this deployment, and what needs a person.
 */
export default async function AffiliateProgramPage() {
  const who = await requireAdmin();
  const overview = await adminProgramOverview(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email });
  const { readiness } = overview;
  const failedEvents = overview.providerEvents.find((row) => row.status === "failed")?.count ?? 0;
  const waitingEvents = overview.providerEvents.find((row) => row.status === "pending")?.count ?? 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Affiliate program"
        description="RepGet's cash partner program: applications, partner links, commissions on Stripe-paid subscriptions, and payouts through Stripe Connect. Not the Partner Network (backlinks), and not the customers' credit referrals."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat label="Applications waiting" value={overview.openApplications} href="/admin/partners/applications" />
        <AdminStat label="Active partners" value={overview.activePartners} href="/admin/partners/partners" />
        <AdminStat label="Suspended partners" value={overview.suspendedPartners} href="/admin/partners/partners?status=suspended" />
        <AdminStat label="Open review cases" value={overview.openReviewCases} hint={failedEvents ? `${failedEvents} Stripe events failed` : waitingEvents ? `${waitingEvents} Stripe events waiting` : undefined} />
      </div>

      <AdminSection title="Program switches" description="Each switch is independent. Every change needs a reason and is recorded in the activity log." tone="danger" bodyClassName="p-0">
        <ul className="divide-y">
          {SWITCHES.map((item) => {
            const state = readiness.controls[item.key];
            return (
              <li key={item.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <AdminStatus tone={state.enabled ? "success" : "neutral"} label={state.enabled ? "On" : "Off"} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{state.enabled ? item.on : item.off}</p>
                  {state.updatedBy ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last changed by {state.updatedBy}
                      {state.reason ? `: "${state.reason}"` : ""}
                    </p>
                  ) : null}
                </div>
                <ReasonAction
                  action={setPartnerControlAction.bind(null, item.key, !state.enabled)}
                  label={state.enabled ? "Switch off…" : "Switch on…"}
                  title={`${state.enabled ? "Switch off" : "Switch on"}: ${item.title}`}
                  description={state.enabled ? item.off : item.on}
                  confirmLabel={state.enabled ? "Switch off" : "Switch on"}
                  success={`${item.title}: ${state.enabled ? "off" : "on"}`}
                  tone={item.key === "partner_payouts" && !state.enabled ? "danger" : "default"}
                />
              </li>
            );
          })}
        </ul>
      </AdminSection>

      <AdminSection title="This deployment" description="What the partner program can do here. Credentials are never shown.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Fact label="Stripe environment" value={readiness.environment ? (readiness.environment === "live" ? "Live" : "Test") : "Not configured (STRIPE_SECRET_KEY)"} />
          <Fact label="Connect onboarding" value={readiness.connectConfigured ? "Available" : "Unavailable without a Stripe key"} />
          <Fact
            label="Live money movement"
            value={
              readiness.environment === "live"
                ? readiness.moneyMovementAllowed
                  ? "Allowed by PARTNER_LIVE_PAYOUTS"
                  : "Blocked: PARTNER_LIVE_PAYOUTS is not 'enabled'"
                : "Not applicable in test mode"
            }
          />
          <Fact label="Payout countries" value={readiness.payoutCountries.join(", ")} />
          <Fact label="Connect webhook" value="/api/stripe/connect-webhook (STRIPE_CONNECT_WEBHOOK_SECRET)" />
          <Fact label="Supported payments" value="Stripe-paid subscriptions only. PayPal payments earn no commission." />
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Rules, rollout and support procedures: <code>docs/partner-program.md</code>. Partners and applications:{" "}
          <Link className="underline underline-offset-4" href="/admin/partners/applications">
            Partner applications
          </Link>
          .
        </p>
      </AdminSection>
    </AdminPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}
