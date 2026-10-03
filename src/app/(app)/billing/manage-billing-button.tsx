"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createPortalSession } from "@/lib/stripe/portal";

/**
 * "Manage billing" for the billing history, when the plan section above does
 * not carry it (the website on screen has no card subscription) but card
 * invoices are kept in Stripe's portal.
 *
 * The same action as the plan section's button: the portal home for the
 * workspace's Stripe customer, which holds every site's invoices. Nothing is
 * changed by opening it; the server still refuses without a customer.
 */
export function ManageBillingButton({
  label,
  opening,
  failed,
}: {
  /** "Manage billing". */
  label: string;
  /** Shown while the portal session is being created. */
  opening: string;
  /** When the session could not be created at all. */
  failed: string;
}) {
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    try {
      const result = await createPortalSession("manage");
      if ("error" in result) {
        toast.error(result.error);
        setPending(false);
        return;
      }
      // assign() rather than location.href: the React Compiler treats
      // assigning to an outer value as a mutation, while a method call is not.
      window.location.assign(result.url);
    } catch {
      toast.error(failed);
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={open} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
      {pending ? opening : label}
      <ExternalLink className="size-4" aria-hidden="true" />
    </Button>
  );
}
