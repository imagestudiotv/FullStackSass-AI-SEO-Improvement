"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CouponForm } from "@/lib/partners/presentation/validation";

type Answer = { ok: true; data: unknown } | { ok: false; error: string };

const TYPES = [
  { value: "percent_first_payment", label: "Percent off the first payment" },
  { value: "percent_first_3_months", label: "Percent off the first 3 months" },
  { value: "fixed_amount", label: "Fixed amount off the first payment" },
] as const;

/**
 * Creates a partner coupon (a Stripe coupon plus its promotion code). Every
 * field is sent as typed and validated on the server; the discount terms
 * are fixed by the type chosen here, never trusted from the form beyond it.
 */
export function CouponCreateForm({ action, currencies }: { action: (form: CouponForm) => Promise<Answer>; currencies: string[] }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState<CouponForm>({
    code: "",
    campaign: "",
    discountType: "percent_first_payment",
    percent: "",
    amount: "",
    currency: currencies[0] ?? "eur",
    startsAt: "",
    expiresAt: "",
    maxRedemptions: "",
    acknowledgeAnnualBehaviour: false,
  });
  const set = (patch: Partial<CouponForm>) => setForm((current) => ({ ...current, ...patch }));
  const fixed = form.discountType === "fixed_amount";
  const ready =
    /^[A-Z0-9]{4,24}$/.test(form.code.trim().toUpperCase()) &&
    form.campaign.trim().length >= 3 &&
    (fixed ? /^\d{1,9}(\.\d{1,3})?$/.test((form.amount ?? "").trim()) : /^\d{1,3}(\.\d{1,2})?$/.test((form.percent ?? "").trim())) &&
    (form.discountType !== "percent_first_3_months" || form.acknowledgeAnnualBehaviour);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Create coupon…
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            start(async () => {
              const result = await action({ ...form, code: form.code.trim().toUpperCase() }).catch(() => null);
              if (!result) return void toast.error("The request failed. Try again.");
              if (!result.ok) return void toast.error(result.error);
              toast.success("Coupon created at Stripe");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Create a partner coupon</DialogTitle>
            <DialogDescription>
              Created in Stripe as a coupon with one promotion code, for first-time customers only. A new customer who uses it is attributed to this partner when no partner link applies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${id}-code`} label="Code" hint="4-24 capital letters or digits.">
              <Input id={`${id}-code`} value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} disabled={pending} autoComplete="off" className="font-mono uppercase" />
            </Field>
            <Field id={`${id}-campaign`} label="Campaign" hint="Shown to administrators.">
              <Input id={`${id}-campaign`} value={form.campaign} onChange={(e) => set({ campaign: e.target.value })} disabled={pending} maxLength={60} />
            </Field>
          </div>
          <Field id={`${id}-type`} label="Discount">
            <select
              id={`${id}-type`}
              value={form.discountType}
              onChange={(e) => set({ discountType: e.target.value as CouponForm["discountType"] })}
              disabled={pending}
              className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
          {fixed ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field id={`${id}-amount`} label="Amount off" hint="For example 10 or 9.50.">
                <Input id={`${id}-amount`} inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} disabled={pending} className="tabular-nums" />
              </Field>
              <Field id={`${id}-currency`} label="Currency">
                <select
                  id={`${id}-currency`}
                  value={form.currency}
                  onChange={(e) => set({ currency: e.target.value })}
                  disabled={pending}
                  className="h-9 rounded-md border bg-background px-2 text-sm uppercase focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <Field id={`${id}-percent`} label="Percent off" hint="For example 20 or 12.5.">
              <Input id={`${id}-percent`} inputMode="decimal" value={form.percent} onChange={(e) => set({ percent: e.target.value })} disabled={pending} className="tabular-nums" />
            </Field>
          )}
          {form.discountType === "percent_first_3_months" ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3">
              <input
                type="checkbox"
                id={`${id}-annual`}
                checked={form.acknowledgeAnnualBehaviour === true}
                onChange={(e) => set({ acknowledgeAnnualBehaviour: e.target.checked })}
                disabled={pending}
                className="mt-0.5 size-4 accent-primary"
              />
              <Label htmlFor={`${id}-annual`} className="text-sm font-normal leading-snug">
                I understand that on an annual plan this discounts the whole first annual payment.
              </Label>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={`${id}-starts`} label="Starts (UTC)">
              <Input id={`${id}-starts`} type="date" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} disabled={pending} />
            </Field>
            <Field id={`${id}-expires`} label="Ends (UTC)">
              <Input id={`${id}-expires`} type="date" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} disabled={pending} />
            </Field>
            <Field id={`${id}-max`} label="Max uses">
              <Input id={`${id}-max`} inputMode="numeric" value={form.maxRedemptions} onChange={(e) => set({ maxRedemptions: e.target.value.replace(/\D/g, "") })} disabled={pending} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !ready}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              Create coupon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
