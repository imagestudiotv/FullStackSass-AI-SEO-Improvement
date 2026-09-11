import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Billing: plan and usage cards, then the payment history list. */
export default function Loading() {
  return <PageSkeleton stats={3} rows={3} />;
}
