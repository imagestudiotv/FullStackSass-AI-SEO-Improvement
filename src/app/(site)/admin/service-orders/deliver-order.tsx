"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markServiceOrderDelivered } from "@/lib/admin/service-orders";

import { DialogError, Spinner } from "../organizations/dialog-fields";

/** "Mark delivered", with what was delivered, for the admin log. */
export function DeliverOrder({ id, service, workspace }: { id: string; service: string; workspace: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setNote("");
    setError(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const result = await markServiceOrderDelivered(id, note).catch(() => null);
      if (!result?.ok) {
        setError(result?.error ?? "The server did not finish this. Try again.");
        return;
      }
      toast.success("Marked delivered");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)} aria-label={`Mark delivered: ${service} for ${workspace}`}>
        Mark delivered
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this order delivered?</DialogTitle>
            <DialogDescription className="wrap-anywhere">
              {service} for {workspace}. The customer sees it as delivered on their Billing page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>What was delivered?</Label>
            <Input id={fieldId} value={note} onChange={(event) => setNote(event.target.value)} placeholder="List of 250 citations emailed" autoComplete="off" disabled={pending} />
            <p className="text-xs text-muted-foreground">Recorded against your name in the admin log.</p>
          </div>
          <DialogError message={error} />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || note.trim().length < 3}>
              {pending ? <Spinner /> : null}
              Mark delivered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
