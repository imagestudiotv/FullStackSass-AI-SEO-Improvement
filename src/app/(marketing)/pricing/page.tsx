import { listPlans } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { listPublishedTestimonials } from "@/lib/marketing/testimonials-db";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { PricingView } from "./pricing-view";

export const metadata = {
  title: "Pricing",
  description: "Simple monthly pricing. Every plan includes everything; plans differ in how much we write for you and how many backlinks you get. Cancel any time.",
  ...publicPageMetadata("/pricing"),
};

/**
 * Public pricing page (client's design of 2026-11-11, pricing-view.tsx).
 *
 * Reads the same plans table the billing page and Stripe checkout use, so a
 * price change is made once and cannot drift between what we advertise and
 * what we charge. Hardcoding these numbers would eventually mean quoting a
 * price the checkout does not honour.
 */
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [plans, testimonials] = await Promise.all([listPlans(), listPublishedTestimonials()]);
  return <PricingView locale="en" plans={plans} testimonials={testimonials} offer={repgetOfferEnabled()} />;
}
