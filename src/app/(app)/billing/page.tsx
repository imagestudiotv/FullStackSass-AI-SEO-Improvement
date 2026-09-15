import {
  getSubscription,
  isEntitled,
  listPayments,
  listPlans,
} from "@/lib/billing";
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
  const remembered = await readSelectedWebsite();
  const websiteId = resolveWebsiteId(
    null,
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

  const params = await searchParams;
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
        />
      {/*
        Below the plans: an add-on is something you buy in addition to a
        subscription, so it should not compete with choosing one.

        Wrapped in the same shell as BillingClient above: without it these
        panels ran the full width of the main area while the plans stayed
        centred, so the content column changed width mid-page.
      */}
      <PageShell className="mt-8">
        <AddonsPanel addons={addons} purchases={purchases} />

        <PaymentsPanel payments={paymentRows} />
      </PageShell>
    </>
  );
}
