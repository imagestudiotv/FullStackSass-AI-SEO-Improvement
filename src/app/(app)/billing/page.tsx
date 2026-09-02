import { getSubscription, isEntitled, listPlans } from "@/lib/billing";
import { requireSession } from "@/lib/auth-guard";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { requireOrg } from "@/lib/tenant";
import { listAddons, listPurchases } from "@/lib/addons/actions";
import { AddonsPanel } from "./addons-panel";
import { BillingClient } from "./billing-client";

export const metadata = { title: "Billing" };

// Subscription state changes via webhook; never serve a cached view of it.
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: PageProps<"/billing">) {
  await requireSession();
  const { orgId } = await requireOrg();

  const [plans, subscription, paypalAvailable, addons, purchases] =
    await Promise.all([
      listPlans(),
      getSubscription(orgId),
      isPayPalAvailable(),
      listAddons(),
      listPurchases(),
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
      />
      {/*
        Below the plans: an add-on is something you buy in addition to a
        subscription, so it should not compete with choosing one.
      */}
      <div className="mt-8">
        <AddonsPanel addons={addons} purchases={purchases} />
      </div>
    </>
  );
}
