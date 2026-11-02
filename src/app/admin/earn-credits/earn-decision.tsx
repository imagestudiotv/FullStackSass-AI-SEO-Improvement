"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveEarnClaim, declineEarnClaim } from "@/lib/earn/admin";

/**
 * Approve (credits added at once) or decline with a reason the customer
 * sees. Both confirm first: approving moves credits, declining tells the
 * customer no.
 */
export function EarnDecision({ id, credits }: { id: string; credits: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const reasonId = useId();

  function run() {
    start(async () => {
      const result = mode === "approve" ? await approveEarnClaim(id) : await declineEarnClaim(id, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "approve" ? `Approved - ${credits} credits added` : "Declined");
      setMode(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={() => setMode("approve")}>
        <Check aria-hidden="true" />
        Approve
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setMode("decline")}>
        <X aria-hidden="true" />
        Decline
      </Button>

      <Dialog open={mode !== null} onOpenChange={(next) => !next && !pending && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? `Approve and add ${credits} credits?` : "Decline this claim?"}</DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? "The credits go to the customer's balance now, and they are notified."
                : "The customer sees your reason and can send it again."}
            </DialogDescription>
          </DialogHeader>
          {mode === "decline" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={reasonId}>Reason</Label>
              <Input id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={pending} placeholder="e.g. The post is not public" />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending || (mode === "decline" && reason.trim().length < 3)} onClick={run}>
              {mode === "approve" ? "Approve" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
