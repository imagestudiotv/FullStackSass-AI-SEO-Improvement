"use client";

import { Coins, Loader2, MoreHorizontal, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustCredits, setOrganizationActive } from "@/lib/admin/operations";

/**
 * The operator controls for one workspace.
 *
 * Gathered behind one menu rather than spread across the row: a table of a
 * hundred customers with three buttons each is unreadable, and every action
 * here is one a support person takes occasionally and deliberately.
 *
 * Both open a dialog that demands a written reason, because both are recorded
 * against the operator's name in the admin log and both are the kind of thing
 * someone asks about weeks later.
 */

type Mode = "credits" | "suspend" | null;

export function WorkspaceActions({
  organizationId,
  organizationName,
  /** The subscription's status, or null when there is no subscription. */
  status,
}: {
  organizationId: string;
  organizationName: string;
  status: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const suspended = status === "inactive";

  function close() {
    setMode(null);
    setReason("");
    setAmount("");
  }

  function submitCredits() {
    const value = Number(amount);
    startTransition(async () => {
      const result = await adjustCredits(organizationId, value, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Balance is now ${result.data.balance} credits`);
      close();
      router.refresh();
    });
  }

  function submitSuspend() {
    startTransition(async () => {
      const result = await setOrganizationActive(
        organizationId,
        suspended,
        reason,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        suspended
          ? `${organizationName} is active again`
          : `${organizationName} is suspended`,
      );
      close();
      router.refresh();
    });
  }

  /**
   * A whole non-zero number within the server's own cap. Checked here too so
   * the obvious typo is caught before a round trip; the server still decides.
   */
  const creditsValid =
    Number.isInteger(Number(amount)) &&
    Number(amount) !== 0 &&
    Math.abs(Number(amount)) <= 1000;
  const reasonValid = reason.trim().length >= 3;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${organizationName}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setMode("credits")}>
            <Coins className="size-4" aria-hidden="true" />
            Adjust credits
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("suspend")}>
            {suspended ? (
              <>
                <Play className="size-4" aria-hidden="true" />
                Reactivate
              </>
            ) : (
              <>
                <Pause className="size-4" aria-hidden="true" />
                Suspend
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={mode === "credits"}
        onOpenChange={(open) => (open ? null : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust credits for {organizationName}</DialogTitle>
            <DialogDescription>
              A positive number adds credits, a negative one takes them away.
              This writes a movement to the ledger rather than setting a total,
              so the change stays visible alongside everything else.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Credits</Label>
              <Input
                id="credit-amount"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-reason">Why?</Label>
              <Input
                id="credit-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Link removed by the host site"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Recorded against your name in the admin log.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={submitCredits}
              disabled={pending || !creditsValid || !reasonValid}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode === "suspend"}
        onOpenChange={(open) => (open ? null : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspended ? "Reactivate" : "Suspend"} {organizationName}?
            </DialogTitle>
            <DialogDescription>
              {suspended
                ? "Generation and publishing start again from the next scheduled run."
                : "Article generation and publishing stop from the next scheduled run. Nothing is deleted, their published articles stay live on their own website, and this can be undone."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Why?</Label>
            <Input
              id="suspend-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                suspended ? "Payment resolved" : "Chargeback under review"
              }
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Recorded against your name in the admin log.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={submitSuspend}
              variant={suspended ? "default" : "destructive"}
              disabled={pending || !reasonValid}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {suspended ? "Reactivate" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
