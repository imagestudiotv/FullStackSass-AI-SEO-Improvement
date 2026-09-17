import {
  getSubscription,
  isEntitled,
  listPayments,
  listPlans, listWebsiteSubscriptions} from "@/lib/billing";
import { PageShell } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth-guard";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import {
  readSelectedWebsite,
  resolveWebsiteId,
} from "@/lib/websites/selected";
import { requireOrg } from "@/lib/tenant";
import { listAddons, listPurchases } from "@/lib/addons/actions";
import { AddonsPanel } from "./addons-panel";
import { PaymentsPanel } from "./payments-panel";
import { BillingClient } from "./billing-client";

export const metadata = { title: "Billing" };

// Subscription state changes via webhook; never serve a cached view of it.
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: PageProps<"/billing">) {
  await requireSession();
  const { orgId } = await requireOrg();

  /**
   * The website a new plan would pay for: the one the switcher is on,
   * resolved exactly as the sidebar does so the two agree.
   */
  const owned = await db
    .select({ id: websites.id })
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(websites.createdAt);
  const websiteSubscriptions = await listWebsiteSubscriptions(orgId);
  const remembered = await readSelectedWebsite();

  /**
   * ?site= wins over the remembered choice.
   *
   * Setup sends someone here to pay for ONE website — the one they just
   * added — and the switcher may still be pointing at an older site they set
   * up weeks ago. Without this, a customer adding their second website would
   * be shown the first one's billing and could subscribe the wrong site.
   *
   * resolveWebsiteId still checks it against what the workspace owns, so an
   * id from elsewhere falls through to the remembered choice rather than
   * selecting anything.
   */
  const earlyParams = await searchParams;
  const siteParam =
    typeof earlyParams.site === "string" ? earlyParams.site : null;

  const websiteId = resolveWebsiteId(
    siteParam,
    remembered,
    owned.map((site) => site.id),
  );

  const [plans, subscription, paypalAvailable, addons, purchases, paymentRows] =
    await Promise.all([
      listPlans(),
      getSubscription(orgId),
      isPayPalAvailable(),
      listAddons(),
      listPurchases(),
      listPayments(orgId),
    ]);

  const params = earlyParams;
  const checkout =
    typeof params.checkout === "string" ? params.checkout : undefined;
  const addonResult = typeof params.addon === "string" ? params.addon : undefined;

  return (
    <>
      <BillingClient
        plans={plans}
        subscription={subscription}
        entitled={isEntitled(subscription?.status)}
        paypalAvailable={paypalAvailable}
        checkout={checkout}
        addonResult={addonResult}
        websiteId={websiteId}
        websiteSubscriptions={websiteSubscriptions}
        />
      {/*
        Below the plans: an add-on is something you buy in addition to a
        subscription, so it should not compete with choosing one.

        Wrapped in the same shell as BillingClient above: without it these
        panels ran the full width of the main area while the plans stayed
        centred, so the content column changed width mid-page.
      */}
      <PageShell className="mt-8">
        {/*
          The target for the sidebar's Add-ons links. scroll-mt clears the
          sticky header, which would otherwise cover the panel heading that
          the customer just asked to be taken to.
        */}
        <div id="addons" className="scroll-mt-20">
          <AddonsPanel addons={addons} purchases={purchases} />
        </div>

        <PaymentsPanel payments={paymentRows} />
      </PageShell>
    </>
  );
}
