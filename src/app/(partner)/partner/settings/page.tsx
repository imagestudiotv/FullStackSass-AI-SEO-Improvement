import { PayoutSetup, type SetupState } from "@/components/partners/payout-setup";
import { CreditPayoutSetup } from "@/components/partners/credit-payout-setup";
import { PayPalPayoutSetup } from "@/components/partners/paypal-payout-setup";
import { PARTNER_CREDITS_COPY } from "@/lib/partners/presentation/credits-copy";
import { payPalPayoutAvailability } from "@/lib/partners/application/use-cases/paypal-payouts";
import { PARTNER_PAYPAL_COPY } from "@/lib/partners/presentation/paypal-copy";
import { payoutSetupStatus, syncPayoutAccount } from "@/lib/partners/application/use-cases/manage-payout-account";
import { fill } from "@/lib/partners/presentation/copy";
import { partnerDeps } from "@/lib/partners/server";

import { countryNames, requirePartnerPage } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.settings.title };
}

/**
 * Profile and payout setup. Coming back from Stripe (?onboarding=returned)
 * re-reads the account from Stripe first - the return itself proves nothing,
 * so the state shown is always what Stripe says.
 */
export default async function PartnerSettingsPage({ searchParams }: PageProps<"/partner/settings">) {
  const { access, copy, locale } = await requirePartnerPage();
  const t = copy.portal;
  const deps = partnerDeps();
  const params = await searchParams;

  if (params.onboarding === "returned") {
    const synced = await syncPayoutAccount(deps, access.context, { partnerId: access.partner.id }).catch(() => null);
    if (synced && !synced.ok && synced.reason !== "not_found" && synced.reason !== "disabled") {
      console.warn("[partners] could not read the account after onboarding", { reason: synced.reason });
    }
  }
  const status = await payoutSetupStatus(deps, access.partner.id);
  const state: SetupState = status.configured ? status.state : "unavailable";
  const country = access.partner.country ?? "";
  const countryName = countryNames([country], locale)[0]?.name ?? country;
  const supported = deps.settings.payoutCountries().includes(country);
  const requirements = status.configured && status.account ? [...status.account.requirementsPastDue, ...status.account.requirementsCurrentlyDue] : [];
  // Partners paid through PayPal (paypal-payouts.ts): offered only where the server says it can run.
  const paypal = payPalPayoutAvailability(deps, access.partner);
  const environment = deps.settings.environment();
  const paypalAccount = environment ? await deps.uow.repositories.paypalPayouts.findAccount(access.partner.id, environment) : null;
  const method = await deps.uow.repositories.paypalPayouts.payoutMethodOf(access.partner.id);
  const showPayPal = access.partner.status === "active" && (paypal.available || paypalAccount !== null || method === "paypal");

  // Partners paid in RepGet credits (owner's decision 2026-11-07): the cash setup is hidden while so.
  const credits = (deps.settings.payoutForm?.() ?? "cash") === "credits";
  const repos = deps.uow.repositories;
  const creditView = credits
    ? await (async () => {
        const [workspaces, current, pack, grants] = await Promise.all([
          access.partner.userId ? repos.credits.ownedWorkspaces(access.partner.userId) : Promise.resolve([]),
          repos.credits.creditWorkspaceOf(access.partner.id),
          repos.credits.smallestPack(),
          environment ? repos.credits.grants(access.partner.id, environment, 12) : Promise.resolve([]),
        ]);
        const money = (minor: number | bigint, currency: string) =>
          new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(Number(minor) / 100);
        return {
          workspaces,
          current,
          rate: pack ? { credits: String(pack.credits), price: money(pack.priceCents, pack.currency) } : null,
          grants: grants.map((grant) => ({
            id: grant.id,
            date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(grant.createdAt),
            commission: money(grant.amount, grant.currency),
            credits: grant.credits,
          })),
        };
      })()
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>
      {creditView ? <CreditPayoutSetup copy={PARTNER_CREDITS_COPY[locale]} {...creditView} /> : null}
      {credits ? null : (
        <>
          <div>
            <h2 className="text-lg font-semibold">{t.setup.title}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t.setup.intro}</p>
          </div>
          <PayoutSetup
            state={state}
            copy={t.setup}
            canAct={access.partner.status === "active" && supported}
            countryLine={supported ? fill(t.setup.country, { country: countryName }) : fill(t.setup.countryUnsupported, { country: countryName })}
            requirements={requirements}
          />
        </>
      )}
      {showPayPal && !credits ? (
        <PayPalPayoutSetup
          copy={PARTNER_PAYPAL_COPY[locale]}
          account={paypalAccount ? { receiver: paypalAccount.receiver, status: paypalAccount.status } : null}
          method={method}
          manual={paypal.available && paypal.mode === "manual"}
          canChooseStripe={state === "ready"}
        />
      ) : null}
      <section className="rounded-xl border bg-card p-6" aria-labelledby="profile-title">
        <h2 id="profile-title" className="font-semibold">{t.settings.profile}</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Fact label={t.settings.name} value={access.partner.displayName} />
          <Fact label={t.settings.email} value={access.partner.contactEmail} />
          <Fact label={t.settings.country} value={countryName} />
          <Fact label={t.settings.code} value={access.partner.referralCode} mono />
          <Fact label={t.settings.status} value={t.settings.statuses[access.partner.status]} />
        </dl>
      </section>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono break-all" : "mt-0.5 break-words"}>{value}</dd>
    </div>
  );
}
