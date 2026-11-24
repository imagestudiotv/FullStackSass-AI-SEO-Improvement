"use client";

import { Ban, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cancelBroadcastNow, deleteBroadcastDraft } from "@/lib/admin/broadcasts";
import type { BroadcastStatus } from "@/lib/broadcasts/shared";

import { DialogError, Spinner } from "../organizations/dialog-fields";

/** One row's menu: edit or delete a draft, stop a scheduled or running one, start a new one from any. */
export function BroadcastActions({ id, status, subject }: { id: string; status: BroadcastStatus; subject: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stoppable = status === "scheduled" || status === "sending";

  function close() {
    if (pending) return;
    setDialog(null);
    setError(null);
  }

  function confirm() {
    setError(null);
    start(async () => {
      const result = await (dialog === "delete" ? deleteBroadcastDraft(id) : cancelBroadcastNow(id)).catch(() => null);
      if (!result?.ok) {
        setError(result?.error ?? "The server did not finish this. Try again.");
        return;
      }
      toast.success(dialog === "delete" ? "Draft deleted" : "Broadcast cancelled");
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${subject}`}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {status === "draft" ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/email-broadcasts?edit=${id}`}>
                <Pencil aria-hidden="true" />
                Edit draft
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/admin/email-broadcasts?copy=${id}`}>
              <Copy aria-hidden="true" />
              Copy as new draft
            </Link>
          </DropdownMenuItem>
          {stoppable ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
              <Ban aria-hidden="true" />
              {status === "sending" ? "Stop sending" : "Cancel schedule"}
            </DropdownMenuItem>
          ) : null}
          {status === "draft" ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 aria-hidden="true" />
              Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "delete" ? "Delete this draft?" : status === "sending" ? "Stop sending this broadcast?" : "Cancel this scheduled broadcast?"}</DialogTitle>
            <DialogDescription className="wrap-anywhere">
              {dialog === "delete"
                ? `"${subject}" is removed. It was never sent.`
                : status === "sending"
                  ? `"${subject}" goes to nobody else. People it already reached keep it: a sent email cannot be recalled.`
                  : `"${subject}" will not be sent. You can copy it as a new draft later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogError message={error} />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? <Spinner /> : null}
              {dialog === "delete" ? "Delete draft" : status === "sending" ? "Stop sending" : "Cancel schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Keeps the counts moving while a broadcast is going out. */
export function RefreshWhileSending({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return null;
}
