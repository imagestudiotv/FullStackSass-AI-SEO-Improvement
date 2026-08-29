import { getSubscription, isEntitled, listPlans } from "@/lib/billing";
import { requireSession } from "@/lib/auth-guard";
import { requireOrg } from "@/lib/tenant";
import { BillingClient } from "./billing-client";

export const metadata = { title: "Billing" };

// Subscription state changes via webhook; never serve a cached view of it.
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: PageProps<"/billing">) {
  await requireSession();
  const { orgId } = await requireOrg();

  const [plans, subscription] = await Promise.all([
    listPlans(),
    getSubscription(orgId),
  ]);

  const params = await searchParams;
  const checkout =
    typeof params.checkout === "string" ? params.checkout : undefined;

  return (
    <BillingClient
      plans={plans}
      subscription={subscription}
      entitled={isEntitled(subscription?.status)}
      checkout={checkout}
    />
  );
}
