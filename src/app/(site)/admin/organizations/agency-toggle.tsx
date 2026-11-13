"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
import { grantAgencyStatus, revokeAgencyStatus } from "@/lib/agency/actions";

import { DialogNotes, Spinner } from "./dialog-fields";

/**
 * Marks a workspace as one of ours, or stops it being one.
 *
 * An agency workspace gets paid features with no subscription, which is why
 * this lives in admin and nowhere else. The confirm step is deliberate: it is
 * a row in a table of many, and a misclick would silently hand someone a free
 * account. (It used to be the browser's own confirm box; this is the same
 * question in the same words, in a dialog that says what it changes.)
 *
 * Opened from the workspace's row menu (see workspace-actions.tsx).
 */
export function AgencyDialog({
  organizationId,
  organizationName,
  isAgency,
  open,
  onClose,
}: {
  organizationId: string;
  organizationName: string;
  isAgency: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = isAgency
        ? await revokeAgencyStatus(organizationId)
        : await grantAgencyStatus(organizationId, "Granted from admin");

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isAgency ? "Agency status removed" : "Now an agency workspace");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || pending ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {isAgency
              ? `Remove agency status from "${organizationName}"?`
              : `Make "${organizationName}" an agency workspace?`}
          </DialogTitle>
          <DialogDescription>
            {isAgency
              ? "It will fall back to its subscription, which may mean losing access."
              : "It gets 50 websites and 500 articles a month without paying."}
          </DialogDescription>
        </DialogHeader>

        <DialogNotes>
          {isAgency ? (
            <li>Any custom limits set for this workspace are removed with the agency status.</li>
          ) : (
            <li>Agency workspaces skip the subscription check entirely - every paid feature, no payment.</li>
          )}
          <li>This change takes no reason and is not written to the admin log.</li>
        </DialogNotes>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={isAgency ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending ? <Spinner /> : <Building2 className="size-4" aria-hidden="true" />}
            {isAgency ? "Remove agency status" : "Make agency workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
