"use client";

import { Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Answer = { ok: true; data: unknown } | { ok: false; error: string };

/*
  The danger tokens rather than the shared "destructive" button variant,
  whose text measures under 4.5:1 on its tinted background in both themes
  (and the danger text itself is lightened on dark surfaces).
*/
const DANGER_TRIGGER = "border-danger/30 bg-danger-soft text-danger hover:border-danger/60 hover:bg-danger-soft hover:text-danger dark:text-red-300 dark:hover:text-red-300";
const DANGER_CONFIRM = "bg-danger text-background hover:bg-danger/90";

/**
 * One administrator decision on the partner program: a button that opens a
 * confirmation saying what will happen, with the reason the audit log
 * requires (optional only where `reasonRequired` is false). The action is a
 * server action bound to its target on the server; it re-checks admin
 * access and validates everything itself.
 */
export function ReasonAction({
  action,
  label,
  title,
  description,
  confirmLabel,
  success,
  tone = "default",
  size = "sm",
  reasonRequired = true,
}: {
  action: (reason: string) => Promise<Answer>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  tone?: "default" | "danger";
  size?: "sm" | "default";
  reasonRequired?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const ready = !reasonRequired || reason.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" size={size} variant="outline" className={tone === "danger" ? DANGER_TRIGGER : undefined}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            start(async () => {
              const result = await action(reason.trim()).catch(() => null);
              if (!result) return void toast.error("The request failed. Try again.");
              if (!result.ok) return void toast.error(result.error);
              // A server-written summary (e.g. what a run did) replaces the generic confirmation.
              const data = result.data as { message?: unknown } | null;
              toast.success(typeof data?.message === "string" ? data.message : success);
              setReason("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="partner-reason">{reasonRequired ? "Reason (recorded in the activity log)" : "Note (optional)"}</Label>
            <Textarea
              id="partner-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
              rows={3}
              maxLength={500}
              aria-describedby="partner-reason-hint"
            />
            <p id="partner-reason-hint" className="text-xs text-muted-foreground">
              {reasonRequired ? "At least 5 characters." : "Shown to administrators only."}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="default" className={tone === "danger" ? DANGER_CONFIRM : undefined} disabled={pending || !ready}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
