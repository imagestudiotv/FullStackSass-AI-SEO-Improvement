"use client";

import { Coins, Loader2, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
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
import {
  adjustCredits,
  deleteOrganization,
  setOrganizationActive,
} from "@/lib/admin/operations";

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

type Mode = "credits" | "suspend" | "delete" | null;

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
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const suspended = status === "inactive";

  function close() {
    setMode(null);
    setReason("");
    setAmount("");
    setConfirm("");
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

  function submitDelete() {
    startTransition(async () => {
      const result = await deleteOrganization(organizationId, reason, confirm);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${organizationName} deleted`);
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
          <DropdownMenuItem
            onSelect={() => setMode("delete")}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete permanently
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

      <Dialog
        open={mode === "delete"}
        onOpenChange={(open) => (open ? null : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {organizationName} permanently?</DialogTitle>
            <DialogDescription>
              This removes the workspace and everything in it — websites,
              articles, keywords, credits and payment history. It cannot be
              undone. For a customer who is only leaving, Suspend is the
              reversible option.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/*
              Stated plainly rather than discovered afterwards. An operator who
              expects deletion to take articles off a customer's live site will
              otherwise tell them it did.
            */}
            <ul className="space-y-1 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              <li>
                Articles already published stay on the customer&apos;s own
                website. We cannot remove those.
              </li>
              <li>
                Links this workspace hosts for other customers stay live on
                their pages.
              </li>
              <li>This deletion is recorded in the admin log.</li>
            </ul>

            <div className="space-y-2">
              <Label htmlFor="delete-reason">Why?</Label>
              <Input
                id="delete-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Customer requested erasure under GDPR"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type DELETE to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={pending || !reasonValid || confirm !== "DELETE"}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
