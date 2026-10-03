"use client";

import {
  Building2,
  Coins,
  CreditCard,
  FileText,
  Globe,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import Link from "next/link";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adjustCredits,
  deleteOrganization,
  setOrganizationActive,
} from "@/lib/admin/operations";

import { AgencyDialog } from "./agency-toggle";
import {
  CONFIRM_WORD,
  ConfirmField,
  DialogError,
  DialogNotes,
  ReasonField,
  reasonOk,
  Spinner,
} from "./dialog-fields";

/**
 * The operator controls for one workspace.
 *
 * Gathered behind one menu rather than spread across the row: a table of a
 * hundred customers with three buttons each is unreadable, and every action
 * here is one a support person takes occasionally and deliberately.
 *
 * Each opens a dialog that demands a written reason (except the agency
 * switch, whose server action takes none), because they are recorded against
 * the operator's name in the admin log and are the kind of thing someone
 * asks about weeks later.
 *
 * Split in three so the Users list can offer the same actions for each of a
 * person's workspaces from one row menu: WorkspaceMenuItems (the items),
 * WorkspaceDialogs (the dialogs, opened by mode) and WorkspaceActions (both,
 * behind the Organizations row's own menu).
 */

export type WorkspaceMode = "credits" | "suspend" | "delete" | "agency";

export type WorkspaceTarget = {
  organizationId: string;
  organizationName: string;
  /** The subscription's status, or null when there is no subscription. */
  status: string | null;
  /** Given on Organizations, where the agency switch lives; omitted elsewhere. */
  isAgency?: boolean;
};

const paymentsHref = (organizationId: string) => `/admin/payments?org=${encodeURIComponent(organizationId)}`;

/** Credits, suspend/reactivate and (on Organizations) the agency switch. */
export function WorkspaceMenuItems({
  target,
  onSelect,
  context,
}: {
  target: WorkspaceTarget;
  onSelect: (mode: WorkspaceMode) => void;
  /**
   * The workspace's name, spoken after each item where one menu holds several
   * workspaces (Users): "Suspend, Acme" rather than three identical "Suspend"s.
   */
  context?: string;
}) {
  const about = context ? <span className="sr-only">, {context}</span> : null;
  const suspended = target.status === "inactive";
  /*
    The server refuses with "This workspace has no subscription to change."
    when there is no subscription row, so the item says so instead of
    opening a dialog that cannot succeed.
  */
  const noSubscription = target.status === null;
  return (
    <>
      <DropdownMenuItem onSelect={() => onSelect("credits")}>
        <Coins aria-hidden="true" />
        Adjust credits
        {about}
      </DropdownMenuItem>
      {/*
        aria-disabled rather than disabled: a disabled menu item is skipped by
        the arrow keys, so a keyboard or screen-reader user never heard why.
        This one stays reachable, says why, and does nothing when chosen.
      */}
      <DropdownMenuItem
        aria-disabled={noSubscription || undefined}
        className={noSubscription ? "opacity-60" : undefined}
        onSelect={(event) => {
          if (noSubscription) return void event.preventDefault();
          onSelect("suspend");
        }}
      >
        {suspended ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        {suspended ? "Reactivate" : "Suspend"}
        {about}
        {noSubscription ? <span className="ml-auto pl-3 text-xs text-muted-foreground">No subscription</span> : null}
      </DropdownMenuItem>
      {target.isAgency !== undefined ? (
        <DropdownMenuItem onSelect={() => onSelect("agency")}>
          <Building2 aria-hidden="true" />
          {target.isAgency ? "Remove agency status" : "Make agency workspace"}
          {about}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

export function WorkspaceDeleteItem({ onSelect, context }: { onSelect: (mode: WorkspaceMode) => void; context?: string }) {
  return (
    <DropdownMenuItem variant="destructive" onSelect={() => onSelect("delete")}>
      <Trash2 aria-hidden="true" />
      Delete workspace…
      {context ? <span className="sr-only">, {context}</span> : null}
    </DropdownMenuItem>
  );
}

/** The row menu on Organizations: related lists, then operations, then deletion. */
export function WorkspaceActions({
  organizationId,
  organizationName,
  status,
  isAgency,
}: WorkspaceTarget) {
  const [mode, setMode] = useState<WorkspaceMode | null>(null);
  const target = { organizationId, organizationName, status, isAgency };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${organizationName}`}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Go to</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/admin/websites?q=${encodeURIComponent(organizationName)}`}>
              <Globe aria-hidden="true" />
              Websites
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/articles?org=${encodeURIComponent(organizationId)}`}>
              <FileText aria-hidden="true" />
              Articles
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={paymentsHref(organizationId)}>
              <CreditCard aria-hidden="true" />
              Payments
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <WorkspaceMenuItems target={target} onSelect={setMode} />
          <DropdownMenuSeparator />
          <WorkspaceDeleteItem onSelect={setMode} />
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceDialogs target={target} mode={mode} onClose={() => setMode(null)} />
    </>
  );
}

/** Every dialog for one workspace; `mode` says which (if any) is open. */
export function WorkspaceDialogs({
  target,
  mode,
  onClose,
}: {
  target: WorkspaceTarget;
  mode: WorkspaceMode | null;
  onClose: () => void;
}) {
  const { organizationId, organizationName, status } = target;
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suspended = status === "inactive";

  /** Every way out (Cancel, Esc, the overlay, the X) resets what was typed. */
  function close() {
    setReason("");
    setAmount("");
    setConfirm("");
    setError(null);
    onClose();
  }

  /** Not while the server is working: the result would land on a closed dialog. */
  function onOpenChange(open: boolean) {
    if (!open && !pending) close();
  }

  function refuse(message: string) {
    setError(message);
    toast.error(message);
  }

  function submitCredits() {
    const value = Number(amount);
    setError(null);
    startTransition(async () => {
      const result = await adjustCredits(organizationId, value, reason);
      if (!result.ok) {
        refuse(result.error);
        return;
      }
      toast.success(`Balance is now ${result.data.balance} credits`);
      close();
      router.refresh();
    });
  }

  function submitDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrganization(organizationId, reason, confirm);
      if (!result.ok) {
        refuse(result.error);
        return;
      }
      toast.success(`${organizationName} deleted`);
      close();
      router.refresh();
    });
  }

  function submitSuspend() {
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationActive(organizationId, suspended, reason);
      if (!result.ok) {
        refuse(result.error);
        return;
      }
      toast.success(suspended ? `${organizationName} is active again` : `${organizationName} is suspended`);
      close();
      router.refresh();
    });
  }

  /**
   * A whole non-zero number within the server's own cap. Checked here too so
   * the obvious typo is caught before a round trip; the server still decides.
   */
  const creditsValid =
    Number.isInteger(Number(amount)) && Number(amount) !== 0 && Math.abs(Number(amount)) <= 1000;
  const reasonValid = reasonOk(reason);

  return (
    <>
      <Dialog open={mode === "credits"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="wrap-anywhere">Adjust credits for {organizationName}</DialogTitle>
            <DialogDescription>
              A positive number adds credits, a negative one takes them away. This writes a movement to the ledger
              rather than setting a total, so the change stays visible alongside everything else.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="credit-amount">Credits</Label>
              <Input
                id="credit-amount"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="5"
                disabled={pending}
                aria-describedby="credit-amount-hint"
                className="tabular-nums"
              />
              <p
                id="credit-amount-hint"
                className={amount !== "" && !creditsValid ? "text-xs text-foreground" : "text-xs text-muted-foreground"}
              >
                A whole number from -1000 to 1000, not 0.
              </p>
            </div>
            <ReasonField
              id="credit-reason"
              value={reason}
              onChange={setReason}
              placeholder="Link removed by the host site"
              disabled={pending}
            />
            <DialogError message={error} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitCredits} disabled={pending || !creditsValid || !reasonValid}>
              {pending ? <Spinner /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "suspend"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="wrap-anywhere">
              {suspended ? "Reactivate" : "Suspend"} {organizationName}?
            </DialogTitle>
            <DialogDescription>
              {suspended
                ? "Generation and publishing start again from the next scheduled run."
                : "Article generation and publishing stop from the next scheduled run. Nothing is deleted, their published articles stay live on their own website, and this can be undone."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <DialogNotes>
              {suspended ? (
                <li>This marks the subscription active here only. Nothing changes with the payment provider.</li>
              ) : (
                <li>
                  Billing is not paused - the payment provider keeps charging. To stop it, cancel or refund from{" "}
                  <Link href={paymentsHref(organizationId)} className="font-medium text-foreground underline underline-offset-4">
                    Payments
                  </Link>
                  .
                </li>
              )}
            </DialogNotes>
            <ReasonField
              id="suspend-reason"
              value={reason}
              onChange={setReason}
              placeholder={suspended ? "Payment resolved" : "Chargeback under review"}
              disabled={pending}
            />
            <DialogError message={error} />
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
              {pending ? <Spinner /> : suspended ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
              {suspended ? "Reactivate" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "delete"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="wrap-anywhere">Delete {organizationName} permanently?</DialogTitle>
            <DialogDescription>
              This removes the workspace and everything in it - websites, articles, keywords, credits and payment
              history. It cannot be undone. For a customer who is only leaving, Suspend is the reversible option.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/*
              Stated plainly rather than discovered afterwards. An operator who
              expects deletion to take articles off a customer's live site will
              otherwise tell them it did.
            */}
            <DialogNotes>
              <li>Articles already published stay on the customer&apos;s own website. We cannot remove those.</li>
              <li>Links this workspace hosts for other customers stay live on their pages.</li>
              <li>
                A workspace whose subscription is still running, or not yet confirmed as cancelled with the payment
                provider, cannot be deleted. Cancel or refund it first from{" "}
                <Link href={paymentsHref(organizationId)} className="font-medium text-foreground underline underline-offset-4">
                  Payments
                </Link>
                .
              </li>
              <li>This deletion is recorded in the admin log.</li>
            </DialogNotes>

            <ReasonField
              id="delete-reason"
              value={reason}
              onChange={setReason}
              placeholder="Customer requested erasure under GDPR"
              disabled={pending}
            />
            <ConfirmField id="delete-confirm" value={confirm} onChange={setConfirm} disabled={pending} />
            <DialogError message={error} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={pending || !reasonValid || confirm !== CONFIRM_WORD}
            >
              {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {target.isAgency !== undefined ? (
        <AgencyDialog
          organizationId={organizationId}
          organizationName={organizationName}
          isAgency={target.isAgency}
          open={mode === "agency"}
          onClose={onClose}
        />
      ) : null}
    </>
  );
}
