"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "./actions";

/**
 * The accept button.
 *
 * A DELIBERATE CLICK, not an automatic acceptance on page load. Email clients
 * and security scanners fetch links in messages before a human ever sees
 * them - accepting on GET would have invitations accept themselves in transit
 * and, worse, would be a CSRF sink: any page could embed this URL as an image
 * and grant access on the reader's behalf. A POST behind a button cannot be
 * triggered that way.
 */
export function AcceptInvitation({
  token,
  domain,
}: {
  token: string;
  domain: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptInvitationAction(token);

      if (!result.ok) {
        toast.error(result.error);
        /*
          The page decides what to render from the invitation's state, and a
          failure usually means that state changed underneath us - it was
          revoked, or accepted in another tab. Re-reading shows the real
          reason instead of leaving a button that will fail again.
        */
        router.refresh();
        return;
      }

      toast.success(`You now have access to ${domain}`);
      router.push(`/websites/${result.websiteId}`);
    });
  }

  return (
    <Button onClick={accept} disabled={pending} className="w-full">
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Check className="size-4" aria-hidden="true" />
      )}
      Accept invitation
    </Button>
  );
}
