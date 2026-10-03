"use client";

import { useState, type ReactElement, type ReactNode } from "react";

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

/**
 * Asks before an action that replaces or takes down something the customer
 * cannot get back from here (a rewrite, a live post sent back to draft).
 *
 * The trigger is the real button, wrapped by Radix's trigger, so focus
 * returns to it when the dialog closes; Escape and the overlay cancel.
 */
export function ConfirmDialog({
  trigger,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled,
}: {
  trigger: ReactElement;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Leaves the trigger as it is without opening anything (the trigger itself is disabled). */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return trigger;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">{children}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
