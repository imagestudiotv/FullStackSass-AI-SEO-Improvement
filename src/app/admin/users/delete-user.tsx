"use client";

import { Trash2 } from "lucide-react";
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
import { deleteUser } from "@/lib/admin/operations";

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
 * Deleting one person's account.
 *
 * Separate from the workspace controls because it targets a different thing:
 * a person can belong to several workspaces, and removing them is not the
 * same as removing any of those. Their sessions and provider logins go with
 * them; the workspaces do not.
 *
 * Typed confirmation rather than a second click. This sits in a table of
 * similar rows and cannot be undone, so the cost of being wrong is higher
 * than the cost of typing six letters.
 *
 * Opened from the person's row menu (user-actions.tsx).
 */
export function DeleteUserDialog({
  userId,
  email,
  open,
  onClose,
}: {
  userId: string;
  email: string;
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
      const result = await deleteUser(userId, reason, confirm);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      /**
       * Named explicitly when workspaces are left without members. They are
       * not deleted with the account — colleagues may share them — so an
       * operator handling an erasure request needs to know there is a second
       * thing to remove.
       */
      const orphans = result.data.orphanedOrganizations;
      toast.success(
        orphans.length > 0 ? `${email} deleted. ${orphans.join(", ")} now has no members.` : `${email} deleted`,
      );
      close();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || pending ? null : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">Delete {email} permanently?</DialogTitle>
          <DialogDescription>
            This removes the person&apos;s account, their sessions and their sign-in methods. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <DialogNotes>
            <li>
              Their workspaces are NOT deleted - colleagues may still be using them. Delete a workspace separately
              from this row&apos;s menu or the Organizations page.
            </li>
            <li>This deletion is recorded in the admin log.</li>
          </DialogNotes>

          <ReasonField
            id="delete-user-reason"
            value={reason}
            onChange={setReason}
            placeholder="Customer requested erasure under GDPR"
            disabled={pending}
          />
          <ConfirmField id="delete-user-confirm" value={confirm} onChange={setConfirm} disabled={pending} />
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
