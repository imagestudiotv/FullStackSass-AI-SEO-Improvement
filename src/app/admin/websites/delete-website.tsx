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
import { deleteWebsite } from "@/lib/admin/operations";

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
 */
export function DeleteWebsiteButton({
  websiteId,
  domain,
  articleCount,
  organizationName,
}: {
  websiteId: string;
  domain: string;
  /** Shown in the dialog, so the scale of the deletion is on screen. */
  articleCount: number;
  organizationName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await deleteWebsite(websiteId, reason, confirm);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.articles > 0
          ? `${result.data.domain} deleted with ${result.data.articles} article${result.data.articles === 1 ? "" : "s"}`
          : `${result.data.domain} deleted`,
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
          aria-label={`Delete ${domain}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {domain} permanently?</DialogTitle>
          <DialogDescription>
            {/*
              The article count is in the description rather than buried in a
              note. It is the number that decides whether this is a typo being
              cleaned up or a year of a customer's content.
            */}
            This removes the website from{" "}
            {organizationName ?? "its workspace"} along with{" "}
            {articleCount > 0
              ? `its ${articleCount} article${articleCount === 1 ? "" : "s"}`
              : "its articles"}
            , keywords and connections. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-1 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <li>
              The workspace, its members and its payment history are NOT
              deleted. Only this website goes.
            </li>
            <li>
              {/*
                The refusal is stated up front rather than left to surprise
                the operator after they have typed the confirmation. A site
                with a live plan cannot be deleted at all - see deleteWebsite,
                which refuses rather than destroying the only local record of
                a subscription Stripe goes on charging.
              */}
              A website with a live subscription cannot be deleted. Cancel or
              refund it first from the Organizations page.
            </li>
            <li>This deletion is recorded in the admin log.</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="delete-website-reason">Why?</Label>
            <Input
              id="delete-website-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Customer added the wrong domain by mistake"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-website-confirm">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-website-confirm"
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
