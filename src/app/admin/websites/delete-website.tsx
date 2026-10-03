"use client";

import { Trash2 } from "lucide-react";
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
import { deleteWebsite } from "@/lib/admin/operations";

import {
  CONFIRM_WORD,
  ConfirmField,
  DialogError,
  DialogNotes,
  ReasonField,
  reasonOk,
  Spinner,
} from "../organizations/dialog-fields";

/**
 * Deleting ONE website.
 *
 * The proportionate version of what the Organizations page offers. Removing a
 * single site used to mean deleting the workspace around it, taking the
 * customer's account, their other websites and their payment history with it.
 *
 * Typed confirmation rather than a second click, matching the other
 * destructive controls: this sits in a table of near-identical rows, and the
 * cost of hitting the wrong one is a customer's content.
 *
 * Opened from the website's row menu (website-actions.tsx).
 */
export function DeleteWebsiteDialog({
  websiteId,
  domain,
  articleCount,
  organizationId,
  organizationName,
  open,
  onClose,
}: {
  websiteId: string;
  domain: string;
  /** Shown in the dialog, so the scale of the deletion is on screen. */
  articleCount: number;
  organizationId: string;
  organizationName: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Every way out resets what was typed: reopening never shows DELETE already filled in. */
  function close() {
    setReason("");
    setConfirm("");
    setError(null);
    onClose();
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await deleteWebsite(websiteId, reason, confirm);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.articles > 0
          ? `${result.data.domain} deleted with ${result.data.articles} article${result.data.articles === 1 ? "" : "s"}`
          : `${result.data.domain} deleted`,
      );
      close();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || pending ? null : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">Delete {domain} permanently?</DialogTitle>
          <DialogDescription>
            {/*
              The article count is in the description rather than buried in a
              note. It is the number that decides whether this is a typo being
              cleaned up or a year of a customer's content.
            */}
            This removes the website from {organizationName ?? "its workspace"} along with{" "}
            {articleCount > 0 ? `its ${articleCount} article${articleCount === 1 ? "" : "s"}` : "its articles"},
            keywords and connections. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <DialogNotes>
            <li>The workspace, its members and its payment history are NOT deleted. Only this website goes.</li>
            <li>
              {/*
                The refusal is stated up front rather than left to surprise
                the operator after they have typed the confirmation. A site
                with a live plan cannot be deleted at all - see deleteWebsite,
                which refuses rather than destroying the only local record of
                a subscription Stripe goes on charging. Cancelling and
                refunding live on Payments, not Organizations.
              */}
              A website with a live subscription cannot be deleted. Cancel or refund it first from{" "}
              <Link
                href={`/admin/payments?org=${encodeURIComponent(organizationId)}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Payments
              </Link>
              .
            </li>
            <li>This deletion is recorded in the admin log.</li>
          </DialogNotes>

          <ReasonField
            id="delete-website-reason"
            value={reason}
            onChange={setReason}
            placeholder="Customer added the wrong domain by mistake"
            disabled={pending}
          />
          <ConfirmField id="delete-website-confirm" value={confirm} onChange={setConfirm} disabled={pending} />
          <DialogError message={error} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={pending || !reasonOk(reason) || confirm !== CONFIRM_WORD}
          >
            {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
