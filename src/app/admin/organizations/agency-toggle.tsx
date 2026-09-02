"use client";

import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { grantAgencyStatus, revokeAgencyStatus } from "@/lib/agency/actions";

/**
 * Marks a workspace as one of ours.
 *
 * An agency workspace gets paid features with no subscription, which is why
 * this lives in admin and nowhere else. The confirm step is deliberate: it is
 * a row in a table of many, and a misclick would silently hand someone a free
 * account.
 */
export function AgencyToggle({
  organizationId,
  organizationName,
  isAgency,
}: {
  organizationId: string;
  organizationName: string;
  isAgency: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const message = isAgency
      ? `Remove agency status from "${organizationName}"? It will fall back to its subscription, which may mean losing access.`
      : `Make "${organizationName}" an agency workspace? It gets 50 websites and 500 articles a month without paying.`;

    if (!window.confirm(message)) return;

    startTransition(async () => {
      const result = isAgency
        ? await revokeAgencyStatus(organizationId)
        : await grantAgencyStatus(organizationId, "Granted from admin");

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isAgency ? "Agency status removed" : "Now an agency workspace");
      router.refresh();
    });
  }

  return (
    <Button
      variant={isAgency ? "secondary" : "ghost"}
      size="sm"
      onClick={handleToggle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Building2 className="size-3.5" />
      )}
      {isAgency ? "Agency" : "Make agency"}
    </Button>
  );
}
