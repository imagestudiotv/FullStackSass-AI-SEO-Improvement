"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeMissingLink } from "@/lib/admin/network";

/**
 * One missing link's "Remove and refund", with the reason the audit log
 * requires. Only for a link an administrator has confirmed is really gone:
 * nothing is refunded automatically (lib/backlinks/placements.ts).
 */
export function RemoveMissingLink({ placementId, credits }: { placementId: string; credits: number }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="flex min-w-64 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await removeMissingLink({ placementId, reason });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Removed. ${result.data.credits} credit${result.data.credits === 1 ? "" : "s"} refunded to the customer.`);
          setReason("");
          router.refresh();
        });
      }}
    >
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason, e.g. customer reported it"
        aria-label="Reason for removing this link"
        className="h-8 text-xs"
        disabled={pending}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || reason.trim().length < 3}>
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
        Remove and refund {credits}
      </Button>
    </form>
  );
}
