"use client";

import { Loader2, Trash2 } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUser } from "@/lib/admin/operations";

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
 */
export function DeleteUserButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await deleteUser(userId, reason, confirm);
      if (!result.ok) {
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
        orphans.length > 0
          ? `${email} deleted. ${orphans.join(", ")} now has no members.`
          : `${email} deleted`,
      );
      setOpen(false);
      setReason("");
      setConfirm("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${email}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {email} permanently?</DialogTitle>
          <DialogDescription>
            This removes the person&apos;s account, their sessions and their
            sign-in methods. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-1 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <li>
              Their workspaces are NOT deleted — colleagues may still be using
              them. Delete a workspace separately from the Organizations page.
            </li>
            <li>This deletion is recorded in the admin log.</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="delete-user-reason">Why?</Label>
            <Input
              id="delete-user-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Customer requested erasure under GDPR"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-user-confirm">Type DELETE to confirm</Label>
            <Input
              id="delete-user-confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={
              pending || reason.trim().length < 3 || confirm !== "DELETE"
            }
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
