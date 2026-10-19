"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
 * A money decision: an amount typed as text (sent as text and parsed
 * exactly on the server - never as a float here), an optional currency and
 * the reason the audit log requires. With `currencies`, the action receives
 * (currency, amount, reason); without, (amount, reason).
 */
export function AmountReasonAction({
  action,
  label,
  title,
  description,
  confirmLabel,
  success,
  amountHint,
  currencies,
  allowNegative = false,
  tone = "default",
}: {
  action: (...args: string[]) => Promise<Answer>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  amountHint: string;
  currencies?: string[];
  allowNegative?: boolean;
  tone?: "default" | "danger";
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(currencies?.[0] ?? "");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const pattern = allowNegative ? /^-?\d{1,15}(\.\d{1,3})?$/ : /^\d{1,15}(\.\d{1,3})?$/;
  const ready = pattern.test(amount.trim()) && reason.trim().length >= 5 && (!currencies || currency);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className={tone === "danger" ? DANGER_TRIGGER : undefined}>
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
              const args = currencies ? [currency, amount.trim(), reason.trim()] : [amount.trim(), reason.trim()];
              const result = await action(...args).catch(() => null);
              if (!result) return void toast.error("The request failed. Try again.");
              if (!result.ok) return void toast.error(result.error);
              toast.success(success);
              setAmount("");
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
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-amount`}>Amount</Label>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={pending}
                aria-describedby={`${id}-amount-hint`}
                className="tabular-nums"
              />
              <p id={`${id}-amount-hint`} className="text-xs text-muted-foreground">
                {amountHint}
              </p>
            </div>
            {currencies ? (
              <div className="grid content-start gap-1.5">
                <Label htmlFor={`${id}-currency`}>Currency</Label>
                <select
                  id={`${id}-currency`}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  disabled={pending}
                  className="h-9 rounded-md border bg-background px-2 text-sm uppercase focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-reason`}>Reason (recorded in the activity log)</Label>
            <Textarea id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} rows={3} maxLength={500} />
            <p className="text-xs text-muted-foreground">At least 5 characters.</p>
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
